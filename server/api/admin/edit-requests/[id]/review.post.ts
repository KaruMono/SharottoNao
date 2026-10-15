import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'
import { z } from 'zod'
import { invalidateGameCaches } from '~/server/utils/redis'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { recordEdit } from '~/server/utils/content-edit'
import { applyGameEditChanges, resolveNewTagNames } from '~/server/utils/edit-request'
import { recordActivity } from '~/server/utils/activity'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { sendNotification } from '~/server/utils/notification'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
} from '~/server/utils/vndb-tag-sync'
import { isPrismaUniqueConstraintError } from '~/server/utils/tag-name'
import { lockGameTagStateInTransaction } from '~/server/utils/game-tag-source'

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
  reviewNote: z.string().max(500).optional(),
  // 管理员在审核界面对标签的调整
  overrides: z.object({
    tagIds: z.array(z.number()).optional(),
    newTags: z.array(z.object({
      name: z.string().min(1).max(100),
      isNsfw: z.boolean().default(false),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    })).optional(),
  }).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)

  const requestId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(requestId)) {
    throw createError({ statusCode: 400, message: '无效的请求ID' })
  }

  const body = await readBody(event)
  const { action, note, reviewNote, overrides } = schema.parse(body)
  const finalNote = note || reviewNote

  const userId = admin.id

  // 获取编辑请求
  const editRequest = await prisma.gameEditRequest.findUnique({
    where: { id: requestId },
    include: { game: true },
  })

  if (!editRequest) {
    throw createError({ statusCode: 404, message: '请求不存在' })
  }

  if (editRequest.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: '该请求已处理' })
  }

  // 提前声明，approve/reject 两个分支外部的 logAdminOperation 都要用到
  const adminAdjusted = !!(overrides?.tagIds !== undefined || overrides?.newTags?.length)

  if (action === 'approve') {
    const changes = editRequest.changes as Record<string, { old: any; new: any }>
    const nextVndbId = changes.vndbId?.new
    const vndbData = typeof nextVndbId === 'string' && nextVndbId
      ? await fetchVndbGame(nextVndbId)
      : null

    try {
      await prisma.$transaction(async (tx) => {
        if ('vndbId' in changes) {
          await lockVndbTagSyncInTransaction(tx)
        }
        await lockGameTagStateInTransaction(tx, editRequest.gameId)

        const claimed = await tx.gameEditRequest.updateMany({
          where: { id: requestId, status: 'PENDING' },
          data: {
            status: 'APPROVED',
            reviewedById: userId,
            reviewedAt: new Date(),
            reviewNote: finalNote,
          },
        })
        if (claimed.count !== 1) {
          throw createError({ statusCode: 409, message: '该请求已被其他审核操作处理' })
        }

        // 先处理新标签：创建缺失的 Tag，将结果 id 并入 changes.tagIds，
        // 并删除 changes.newTagNames（避免快照残留）。
        // resolveNewTagNames 会就地修改 changes 对象，applyGameEditChanges 直接消费结果。
        const hasNewTags = 'newTagNames' in changes || overrides?.tagIds !== undefined || overrides?.newTags?.length
        if (hasNewTags) {
          await resolveNewTagNames(tx, changes, overrides as any)
        }

        await applyGameEditChanges(tx, editRequest.gameId, changes)

        if (vndbData?.isNsfw) {
          await tx.game.update({ where: { id: editRequest.gameId }, data: { isNsfw: true } })
        }

        if ('vndbId' in changes) {
          await syncVndbTagsForGameInTransaction(tx, {
            gameId: editRequest.gameId,
            tags: vndbData?.tags || [],
            expectedVndbId: nextVndbId || null,
          })
          if (!nextVndbId) {
            await tx.game.update({
              where: { id: editRequest.gameId },
              data: { vndbTagsSyncedAt: null },
            })
          }
        }
      })
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw createError({ statusCode: 409, message: '标签名称、别名或标识已被占用' })
      }
      throw error
    }

    await invalidateGameCaches(editRequest.gameId)

    // 构建详细变更记录
    const FIELD_LABELS: Record<string, string> = {
      titleEn: '英文标题', titleJa: '日文标题', titleZhHans: '简体中文标题', titleZhHant: '繁体中文标题',
      descriptionEn: '英文简介', descriptionJa: '日文简介', descriptionZhHans: '简体中文简介', descriptionZhHant: '繁体中文简介',
      coverImage: '封面图片', releaseDate: '发售日期', isNsfw: 'NSFW 标记', vndbId: 'VNDB ID', bangumiId: 'Bangumi ID',
      seriesId: '游戏系列', lengthMinutes: '游戏时长',
      aliases: '别名', purchaseLinks: '相关链接', tagIds: '标签', newTagNames: '新增标签', staff: 'STAFF', companies: '关联会社',
    }
    const changedLabels = Object.keys(changes).map(k => FIELD_LABELS[k] || k)
    // 记录是否有管理员调整（用于 log 说明，已在函数顶部声明）
    const detailedChanges = Object.entries(changes).map(([field, val]) => ({
      field,
      label: FIELD_LABELS[field] || field,
      old: val.old,
      new: val.new,
    }))

    await recordEdit({
      targetType: 'GAME',
      targetId: editRequest.gameId,
      editorId: editRequest.userId,
      snapshot: {
        ...(editRequest.game as unknown as Record<string, unknown>),
        _changes: detailedChanges,
      },
    changeSummary: `用户修改请求审核通过（${changedLabels.join('，')}）${adminAdjusted ? '（管理员已调整标签）' : ''}`,
    })

    recordActivity({
      userId: editRequest.userId,
      type: 'EDIT_GAME',
      targetType: 'game',
      targetId: editRequest.gameId,
      meta: {
        gameTitle: editRequest.game.titleZhHans || editRequest.game.titleJa || editRequest.game.titleEn,
        changedFields: changedLabels,
      },
    })

    // 更新封面图使用状态
    if (changes.coverImage) {
      await markImageAsUnused(changes.coverImage.old)
      await markImageAsUsed(changes.coverImage.new, editRequest.gameId)
    }

    // 提交到 IndexNow
    submitGameToIndexNow(editRequest.gameId, 'UPDATE').catch(err => {
      console.error('IndexNow submission failed:', err)
    })

    // 发送通知给提交者
    await sendNotification({
      senderId: userId,
      receiverId: editRequest.userId,
      type: 'EDIT_APPROVED',
      title: '修改请求已通过',
      content: `您对「${editRequest.game.titleZhHans || editRequest.game.titleJa || editRequest.game.titleEn}」的修改请求已通过审核`,
      relatedUrl: `/games/${editRequest.gameId}`,
    })
  } else {
    // 驳回请求
    const rejected = await prisma.gameEditRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNote: finalNote,
      },
    })
    if (rejected.count !== 1) {
      throw createError({ statusCode: 409, message: '该请求已被其他审核操作处理' })
    }

    // 发送通知给提交者
    await sendNotification({
      senderId: userId,
      receiverId: editRequest.userId,
      type: 'EDIT_REJECTED',
      title: '修改请求已驳回',
      content: `您对「${editRequest.game.titleZhHans || editRequest.game.titleJa || editRequest.game.titleEn}」的修改请求已被驳回${finalNote ? `，原因：${finalNote}` : ''}`,
      relatedUrl: `/games/${editRequest.gameId}`,
    })
  }

  const gameTitle = editRequest.game.titleZhHans || editRequest.game.titleJa || editRequest.game.titleEn || `Game #${editRequest.gameId}`

  await logAdminOperation({
    adminId: userId,
    action: action === 'approve' ? 'APPROVE_EDIT_REQUEST' : 'REJECT_EDIT_REQUEST',
    targetType: 'GameEditRequest',
    targetId: requestId,
    content: `条目修改审核; 游戏: ${gameTitle}(#${editRequest.gameId}); 提交者: #${editRequest.userId}${adminAdjusted ? '; 管理员已调整标签' : ''}${finalNote ? `; 备注: ${finalNote}` : ''}`,
  })

  return { success: true }
})

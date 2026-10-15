import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'
import { recordActivity } from '~/server/utils/activity'
import { recordEdit } from '~/server/utils/content-edit'
import { diffGame } from '~/server/utils/game-diff'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { invalidateGameCaches } from '~/server/utils/redis'
import { resolveNsfwMode } from '~/server/utils/nsfw'
import { normalizeTagNames } from '~/server/utils/tag-normalize'
import { mergeRequestedTagIdsPreservingHidden } from '~/server/utils/tag-visibility'
import {
  isPrismaUniqueConstraintError,
  resolveOrCreateTagByNameInTransaction,
  TagNameConflictError,
} from '~/server/utils/tag-name'
import { replaceManualGameTagsInTransaction } from '~/server/utils/game-tag-source'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
  type VndbTagInput,
} from '~/server/utils/vndb-tag-sync'

const purchaseLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
})

const schema = z.object({
  titleEn: z.string().optional(),
  titleJa: z.string().optional(),
  titleZhHans: z.string().optional(),
  titleZhHant: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  descriptionEn: z.string().optional(),
  descriptionJa: z.string().optional(),
  descriptionZhHans: z.string().optional(),
  descriptionZhHant: z.string().optional(),
  coverImage: z.string().min(1, '请上传封面图'),
  releaseDate: z.string().optional(),
  tagIds: z.array(z.number()).optional(),
  // 管理员可以直接输入不存在的标签名，保存时即时创建
  newTagNames: z.array(z.string().min(1).max(100)).max(20).optional(),
  isNsfw: z.boolean().optional(),
  vndbId: z.string().optional(),
  bangumiId: z.number().optional(),
  purchaseLinks: z.array(purchaseLinkSchema).optional(),
  seriesId: z.number().int().positive().nullable().optional(),
})

// 获取显示标题
function getDisplayTitle(data: { titleEn?: string | null; titleJa?: string | null; titleZhHans?: string | null; titleZhHant?: string | null }): string {
  return data.titleZhHans || data.titleZhHant || data.titleJa || data.titleEn || ''
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const existingGame = await prisma.game.findUnique({
    where: { id, deletedAt: null },
    include: {
      tags: {
        where: { sources: { some: { source: 'MANUAL' } } },
        include: {
          tag: { select: { isNsfw: true, archivedAt: true } },
        },
      },
    },
  })

  if (!existingGame) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  if (data.tagIds !== undefined) {
    data.tagIds = mergeRequestedTagIdsPreservingHidden(
      data.tagIds,
      existingGame.tags,
      resolveNsfwMode(user),
    )
  }

  // 验证至少有一个标题
  if (!data.titleEn && !data.titleJa && !data.titleZhHans && !data.titleZhHant) {
    throw createError({
      statusCode: 400,
      message: '至少需要填写一个语言的标题',
    })
  }

  // 验证至少有一个简介
  if (!data.descriptionEn && !data.descriptionJa && !data.descriptionZhHans && !data.descriptionZhHant) {
    throw createError({
      statusCode: 400,
      message: '至少需要填写一个语言的简介',
    })
  }

  // 判断是否可以直接编辑（管理员或编辑员可以直接编辑）
  const canDirectEdit = user.role === 'ADMIN' || user.role === 'EDITOR'

  if (canDirectEdit) {
    // 管理员/编辑员直接更新
    const updateData: any = {
      titleEn: data.titleEn || null,
      titleJa: data.titleJa || null,
      titleZhHans: data.titleZhHans || null,
      titleZhHant: data.titleZhHant || null,
      aliases: data.aliases || [],
      descriptionEn: data.descriptionEn || null,
      descriptionJa: data.descriptionJa || null,
      descriptionZhHans: data.descriptionZhHans || null,
      descriptionZhHant: data.descriptionZhHant || null,
      coverImage: data.coverImage,
      isNsfw: data.isNsfw ?? existingGame.isNsfw,
      ...(data.vndbId !== undefined && { vndbId: data.vndbId || null }),
      ...(data.bangumiId !== undefined && { bangumiId: data.bangumiId || null }),
      purchaseLinks: data.purchaseLinks || [],
    }

    // 处理系列关联
    if (data.seriesId !== undefined) {
      updateData.seriesId = data.seriesId
    }

    // 处理发售日期
    if (data.releaseDate) {
      updateData.releaseDate = new Date(data.releaseDate)
    }

    const nextVndbId = data.vndbId === undefined ? existingGame.vndbId : (data.vndbId || null)
    const vndbChanged = nextVndbId !== existingGame.vndbId
    let vndbTags: VndbTagInput[] | null = null
    let vndbIsNsfw = false
    if (nextVndbId && (vndbChanged || !existingGame.vndbTagsSyncedAt)) {
      const vndbData = await fetchVndbGame(nextVndbId)
      vndbTags = vndbData.tags
      vndbIsNsfw = vndbData.isNsfw
    }
    if (vndbIsNsfw) updateData.isNsfw = true

    // 更新游戏并重建标签关联（事务保证标签删除与重建同时生效）
    let game
    try {
      game = await prisma.$transaction(async (tx) => {
        if (vndbChanged || vndbTags) {
          await lockVndbTagSyncInTransaction(tx)
        }

        const updated = await tx.game.update({
          where: { id },
          data: updateData,
        })

        // 先处理 newTagNames：管理员直接创建，无需审核
        let finalTagIds = data.tagIds ?? existingGame.tags.map(tag => tag.tagId)
        if (data.newTagNames?.length) {
          const normalized = normalizeTagNames(data.newTagNames)
          const newIds: number[] = []
          for (const name of normalized) {
            const { tag } = await resolveOrCreateTagByNameInTransaction(tx, {
              name,
              isNsfw: false,
            })
            newIds.push(tag.id)
          }
          // 新建标签 id 并入 tagIds（去重）
          finalTagIds = [...new Set([...finalTagIds, ...newIds])]
        }

        // 更新标签关联（有 tagIds 或 newTagNames 时才重建）
        if (data.tagIds !== undefined || data.newTagNames?.length) {
          await replaceManualGameTagsInTransaction(tx, id, finalTagIds)
        }

        if (vndbChanged || vndbTags) {
          await syncVndbTagsForGameInTransaction(tx, {
            gameId: id,
            tags: vndbTags || [],
            expectedVndbId: nextVndbId,
          })
          if (!nextVndbId) {
            await tx.game.update({ where: { id }, data: { vndbTagsSyncedAt: null } })
          }
        }

        return updated
      })
    } catch (e: any) {
      if (e.code === 'P2002' && e.meta?.target?.includes('vndbId')) {
        throw createError({ statusCode: 400, message: '该 VNDB ID 已被其他游戏使用' })
      }
      if (isPrismaUniqueConstraintError(e)) {
        throw createError({ statusCode: 409, message: '标签名称、别名或标识已被占用' })
      }
      if (e instanceof TagNameConflictError) {
        throw createError({ statusCode: 409, message: e.message })
      }
      throw e
    }

    const { changes, summary } = diffGame(
      existingGame as unknown as Record<string, unknown>,
      { ...data, tagIds: data.tagIds },
      '编辑游戏条目',
    )

    await recordEdit({
      targetType: 'GAME',
      targetId: id,
      editorId: user.id,
      snapshot: {
        ...(existingGame as unknown as Record<string, unknown>),
        _changes: changes,
      },
      changeSummary: summary,
    })

    recordActivity({
      userId: user.id,
      type: 'EDIT_GAME',
      targetType: 'game',
      targetId: id,
      meta: {
        gameTitle: existingGame.titleZhHans || existingGame.titleJa || existingGame.titleEn || `Game #${id}`,
        gameCover: data.coverImage || existingGame.coverImage,
        changedFields: changes.map(c => c.label),
      },
    })

    // 更新图片使用状态
    if (existingGame.coverImage !== data.coverImage) {
      // 标记旧封面为未使用
      await markImageAsUnused(existingGame.coverImage)
      // 标记新封面为已使用
      await markImageAsUsed(data.coverImage, id)
    }

    submitGameToIndexNow(id, 'UPDATE').catch(err => console.error('IndexNow submission failed:', err))
    invalidateGameCaches(id).catch(() => {})

    return {
      id: game.id,
      title: getDisplayTitle(game),
      needsReview: false,
    }
  } else {
    // 普通用户需要提交审核请求
    
    // 检查是否有待处理的编辑请求
    const pendingRequest = await prisma.gameEditRequest.findFirst({
      where: {
        gameId: id,
        userId: user.id,
        status: 'PENDING',
      },
    })

    if (pendingRequest) {
      throw createError({
        statusCode: 400,
        message: '您已有一个待审核的修改请求，请等待审核完成后再提交新的修改',
      })
    }

    // 构建变更记录
    const changes: Record<string, { old: any; new: any }> = {}

    // 比较字段变化
    const fieldsToCompare = [
      'titleEn', 'titleJa', 'titleZhHans', 'titleZhHant',
      'descriptionEn', 'descriptionJa', 'descriptionZhHans', 'descriptionZhHant',
      'coverImage', 'isNsfw', 'vndbId', 'bangumiId',
    ]

    for (const field of fieldsToCompare) {
      const oldValue = (existingGame as any)[field]
      const newValue = (data as any)[field]
      
      // 处理 null/undefined 和空字符串的比较
      const normalizedOld = oldValue === null || oldValue === undefined ? '' : oldValue
      const normalizedNew = newValue === null || newValue === undefined ? '' : newValue
      
      if (normalizedOld !== normalizedNew) {
        changes[field] = { old: oldValue, new: newValue || null }
      }
    }

    // 比较别名
    const oldAliases = existingGame.aliases || []
    const newAliases = data.aliases || []
    if (JSON.stringify(oldAliases) !== JSON.stringify(newAliases)) {
      changes.aliases = { old: oldAliases, new: newAliases }
    }

    // 比较购买链接
    const oldPurchaseLinks = existingGame.purchaseLinks || []
    const newPurchaseLinks = data.purchaseLinks || []
    if (JSON.stringify(oldPurchaseLinks) !== JSON.stringify(newPurchaseLinks)) {
      changes.purchaseLinks = { old: oldPurchaseLinks, new: newPurchaseLinks }
    }

    // 比较发售日期
    const oldReleaseDate = existingGame.releaseDate ? existingGame.releaseDate.toISOString().split('T')[0] : null
    const newReleaseDate = data.releaseDate || null
    if (oldReleaseDate !== newReleaseDate) {
      changes.releaseDate = { old: oldReleaseDate, new: newReleaseDate }
    }

    // 比较标签
    if (data.tagIds !== undefined) {
      const oldTagIds = existingGame.tags.map(t => t.tagId).sort()
      const newTagIds = [...data.tagIds].sort()
      if (JSON.stringify(oldTagIds) !== JSON.stringify(newTagIds)) {
        changes.tagIds = { old: oldTagIds, new: newTagIds }
      }
    }

    // 如果没有任何变化
    if (Object.keys(changes).length === 0) {
      throw createError({
        statusCode: 400,
        message: '没有检测到任何修改',
      })
    }

    // 创建编辑请求
    await prisma.gameEditRequest.create({
      data: {
        gameId: id,
        userId: user.id,
        changes: changes,
        status: 'PENDING',
      },
    })

    return {
      id: existingGame.id,
      title: getDisplayTitle(existingGame),
      needsReview: true,
      message: '您的修改已提交，等待管理员审核',
    }
  }
})

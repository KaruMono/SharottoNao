import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateGameCaches } from '~/server/utils/redis'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { applyGameEditChanges } from '~/server/utils/edit-request'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
} from '~/server/utils/vndb-tag-sync'

const schema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const body = await readBody(event)
  const { ids, action, note } = schema.parse(body)

  let successCount = 0
  const skippedIds: number[] = [] // 需单独审核或已被并发处理

  // 获取所有待处理的请求
  const requests = await prisma.gameEditRequest.findMany({
    where: {
      id: { in: ids },
      status: 'PENDING',
    },
    include: { game: true },
  })

  for (const request of requests) {
    try {
      if (action === 'approve') {
        const changes = request.changes as Record<string, { old: any; new: any }>

        // 含 newTagNames 的请求需要管理员逐条确认标签，不能批量通过
        if ('newTagNames' in changes) {
          skippedIds.push(request.id)
          continue
        }

        const nextVndbId = changes.vndbId?.new
        const vndbData = typeof nextVndbId === 'string' && nextVndbId
          ? await fetchVndbGame(nextVndbId)
          : null

        await prisma.$transaction(async (tx) => {
          const claimed = await tx.gameEditRequest.updateMany({
            where: { id: request.id, status: 'PENDING' },
            data: {
              status: 'APPROVED',
              reviewedById: admin.id,
              reviewedAt: new Date(),
              reviewNote: note,
            },
          })
          if (claimed.count !== 1) {
            throw createError({ statusCode: 409, message: '该请求已被其他审核操作处理' })
          }

          if ('vndbId' in changes) {
            await lockVndbTagSyncInTransaction(tx)
          }
          await applyGameEditChanges(tx, request.gameId, changes)

          if (vndbData?.isNsfw) {
            await tx.game.update({ where: { id: request.gameId }, data: { isNsfw: true } })
          }

          if ('vndbId' in changes) {
            await syncVndbTagsForGameInTransaction(tx, {
              gameId: request.gameId,
              tags: vndbData?.tags || [],
              expectedVndbId: nextVndbId || null,
            })
            if (!nextVndbId) {
              await tx.game.update({
                where: { id: request.gameId },
                data: { vndbTagsSyncedAt: null },
              })
            }
          }
        })

        await invalidateGameCaches(request.gameId)

        // 提交到 IndexNow
        submitGameToIndexNow(request.gameId, 'UPDATE').catch(err => {
          console.error('IndexNow submission failed:', err)
        })
      } else {
        // 直接驳回
        const rejected = await prisma.gameEditRequest.updateMany({
          where: { id: request.id, status: 'PENDING' },
          data: {
            status: 'REJECTED',
            reviewedById: admin.id,
            reviewedAt: new Date(),
            reviewNote: note,
          },
        })
        if (rejected.count !== 1) {
          skippedIds.push(request.id)
          continue
        }
      }
      successCount++
    } catch (error) {
      console.error(`Failed to process request ${request.id}:`, error)
    }
  }

  await logAdminOperation({
    adminId: admin.id,
    action: action === 'approve' ? 'BATCH_APPROVE_EDIT_REQUESTS' : 'BATCH_REJECT_EDIT_REQUESTS',
    targetType: 'GameEditRequest',
    content: `批量${action === 'approve' ? '通过' : '驳回'} ${successCount} 个条目修改请求; ids=${ids.join(',')}${note ? `; 备注: ${note}` : ''}`,
  })

  return { 
    success: true, 
    message: `已${action === 'approve' ? '通过' : '驳回'} ${successCount} 个请求${skippedIds.length ? `，${skippedIds.length} 个请求需单独检查（id: ${skippedIds.join(', ')}）` : ''}`,
    count: successCount,
    skipped: skippedIds,
  }
})

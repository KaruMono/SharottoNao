import { z } from 'zod'
import { requireEditor, requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateGameCaches } from '~/server/utils/redis'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { lockExistingGameTagStatesInTransaction } from '~/server/utils/game-tag-source'
import { lockVndbTagSyncInTransaction } from '~/server/utils/vndb-tag-sync'

const schema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['restore', 'purge']),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { ids, action } = schema.parse(body)

  if (action === 'purge') {
    const admin = await requireAdmin(event)
    let purgedCount = 0

    for (const id of ids) {
      const purged = await prisma.$transaction(async (tx) => {
        await lockVndbTagSyncInTransaction(tx)
        const lockedIds = await lockExistingGameTagStatesInTransaction(tx, [id])
        if (lockedIds.length === 0) return false

        const game = await tx.game.findUnique({
          where: { id },
          select: { deletedAt: true },
        })
        if (!game?.deletedAt) return false

        await tx.gameTag.deleteMany({ where: { gameId: id } })
        await tx.gameCompany.deleteMany({ where: { gameId: id } })
        await tx.gameStaff.deleteMany({ where: { gameId: id } })
        await tx.screenshot.deleteMany({ where: { gameId: id } })
        await tx.favorite.deleteMany({ where: { gameId: id } })
        await tx.rating.deleteMany({ where: { gameId: id } })
        await tx.gameBump.deleteMany({ where: { gameId: id } })
        await tx.comment.deleteMany({ where: { gameId: id } })
        await tx.resource.deleteMany({ where: { gameId: id } })
        await tx.guide.deleteMany({ where: { gameId: id } })
        await tx.image.deleteMany({ where: { gameId: id } })
        await tx.gameEditRequest.deleteMany({ where: { gameId: id } })
        await tx.contentEdit.deleteMany({ where: { targetType: 'GAME', targetId: id } })
        await tx.activity.deleteMany({ where: { targetType: 'game', targetId: id } })
        await tx.game.delete({ where: { id } })
        return true
      })
      if (purged) {
        purgedCount += 1
        await invalidateGameCaches(id)
      }
    }

    await logAdminOperation({
      adminId: admin.id,
      action: 'BATCH_PURGE_GAMES',
      targetType: 'Game',
      content: `批量彻底删除 ${purgedCount} 个游戏 ids=${ids.join(',')}`,
    })

    return { success: true, message: `已彻底删除 ${purgedCount} 个游戏` }
  }

  const admin = await requireEditor(event)

  const result = await prisma.game.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  })

  await invalidateGameCaches()

  await logAdminOperation({
    adminId: admin.id,
    action: 'BATCH_RESTORE_GAMES',
    targetType: 'Game',
    content: `批量恢复 ${result.count} 个游戏 ids=${ids.join(',')}`,
  })

  return { success: true, message: `已恢复 ${result.count} 个游戏` }
})

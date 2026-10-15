import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { invalidateGameCaches } from '~/server/utils/redis'
import { lockExistingGameTagStatesInTransaction } from '~/server/utils/game-tag-source'
import { lockVndbTagSyncInTransaction } from '~/server/utils/vndb-tag-sync'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const game = await prisma.game.findUnique({
    where: { id },
    select: { id: true, titleZhHans: true, titleJa: true, titleEn: true, deletedAt: true },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  if (!game.deletedAt) {
    throw createError({ statusCode: 400, message: '只能彻底删除已软删除的条目，请先软删除' })
  }

  const title = game.titleZhHans || game.titleJa || game.titleEn || `#${id}`

  await prisma.$transaction(async (tx) => {
    await lockVndbTagSyncInTransaction(tx)
    const lockedIds = await lockExistingGameTagStatesInTransaction(tx, [id])
    if (lockedIds.length === 0) {
      throw createError({ statusCode: 404, message: '条目不存在' })
    }

    const lockedGame = await tx.game.findUnique({
      where: { id },
      select: { deletedAt: true },
    })
    if (!lockedGame?.deletedAt) {
      throw createError({ statusCode: 409, message: '条目已恢复，无法彻底删除' })
    }

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
  })

  await logAdminOperation({
    adminId: admin.id,
    action: 'PURGE_GAME',
    targetType: 'Game',
    targetId: id,
    content: `彻底删除游戏「${title}」及其所有关联数据`,
  })

  invalidateGameCaches(id).catch(() => {})

  return { success: true, message: '已彻底删除' }
})

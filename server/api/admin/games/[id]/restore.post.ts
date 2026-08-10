import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const game = await prisma.game.findUnique({
    where: { id },
    select: { id: true, titleZhHans: true, titleJa: true, titleEn: true, deletedAt: true, isNsfw: true },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  if (!game.deletedAt) {
    throw createError({ statusCode: 400, message: '该条目未被删除' })
  }

  await prisma.game.update({
    where: { id },
    data: { deletedAt: null },
  })

  const title = game.titleZhHans || game.titleJa || game.titleEn || `#${id}`
  await logAdminOperation({
    adminId: admin.id,
    action: 'RESTORE_GAME',
    targetType: 'Game',
    targetId: id,
    content: `恢复已删除的游戏「${title}」`,
  })

  submitGameToIndexNow(id, 'ADD').catch(err => console.error('IndexNow submission failed:', err))
  invalidateGameCaches(id).catch(() => {})

  return { success: true, message: '恢复成功' }
})

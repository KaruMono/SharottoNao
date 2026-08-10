import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  const game = await prisma.game.findUnique({
    where: { id, deletedAt: null },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  // 软删除
  await prisma.game.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  submitGameToIndexNow(id, 'DELETE').catch(err => console.error('IndexNow submission failed:', err))
  invalidateGameCaches(id).catch(() => {})

  return { success: true, message: '删除成功' }
})

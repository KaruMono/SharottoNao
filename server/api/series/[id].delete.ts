import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的系列ID',
    })
  }

  // 删除系列（游戏的 seriesId 会被设为 null）
  await prisma.gameSeries.delete({
    where: { id },
  })

  return { success: true }
})

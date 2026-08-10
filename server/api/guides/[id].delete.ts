import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const guideId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(guideId)) {
    throw createError({ statusCode: 400, message: '无效的攻略ID' })
  }

  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: { userId: true },
  })

  if (!guide) {
    throw createError({ statusCode: 404, message: '攻略不存在' })
  }

  // 只有作者或管理员可以删除
  if (guide.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: '无权删除此攻略' })
  }

  await prisma.$transaction([
    prisma.activity.deleteMany({
      where: { targetType: 'guide', targetId: guideId },
    }),
    prisma.guide.delete({
      where: { id: guideId },
    }),
  ])

  return { success: true }
})

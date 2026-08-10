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
    include: { game: { select: { deletedAt: true } } },
  })

  if (!guide || guide.game.deletedAt) {
    throw createError({ statusCode: 404, message: '攻略不存在' })
  }

  const existingLike = await prisma.guideLike.findUnique({
    where: {
      guideId_userId: {
        guideId,
        userId: user.id,
      },
    },
  })

  if (existingLike) {
    await prisma.guideLike.delete({ where: { id: existingLike.id } })
    const updated = await prisma.guide.update({
      where: { id: guideId },
      data: { likeCount: { decrement: 1 } },
    })
    return { liked: false, likeCount: Math.max(0, updated.likeCount) }
  }

  await prisma.guideLike.create({
    data: {
      guideId,
      userId: user.id,
    },
  })
  const updated = await prisma.guide.update({
    where: { id: guideId },
    data: { likeCount: { increment: 1 } },
  })

  return { liked: true, likeCount: updated.likeCount }
})

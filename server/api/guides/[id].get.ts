import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const guideId = Number.parseInt(getRouterParam(event, 'id') || '')
  if (Number.isNaN(guideId)) {
    throw createError({ statusCode: 400, message: '无效的攻略ID' })
  }

  const user = await getAuthUser(event)
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, game: { deletedAt: null } },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
      game: { select: { id: true, titleEn: true, titleJa: true, titleZhHans: true, titleZhHant: true } },
      _count: { select: { likes: true } },
    },
  })

  if (!guide) {
    throw createError({ statusCode: 404, message: '攻略不存在' })
  }

  const isLiked = user
    ? Boolean(await prisma.guideLike.findUnique({
        where: { guideId_userId: { guideId, userId: user.id } },
        select: { id: true },
      }))
    : false

  return {
    ...guide,
    likeCount: guide._count.likes,
    isLiked,
    _count: undefined,
  }
})

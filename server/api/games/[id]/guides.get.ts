import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的游戏ID' })
  }

  const query = getQuery(event)
  const { page, limit } = querySchema.parse(query)
  const skip = (page - 1) * limit

  const [guides, total, userLikes] = await Promise.all([
    prisma.guide.findMany({
      where: { gameId },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
        _count: {
          select: { likes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.guide.count({ where: { gameId } }),
    user ? prisma.guideLike.findMany({
      where: { userId: user.id, guide: { gameId } },
      select: { guideId: true },
    }) : [],
  ])

  const likedGuideIds = new Set(userLikes.map(like => like.guideId))

  return {
    items: guides.map(guide => ({
      ...guide,
      likeCount: (guide as any)._count?.likes ?? guide.likeCount,
      isLiked: likedGuideIds.has(guide.id),
      _count: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

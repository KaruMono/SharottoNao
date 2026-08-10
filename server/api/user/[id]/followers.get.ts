import prisma from '~/server/utils/prisma'
import { resolveAvatar } from '~/server/utils/gravatar'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  const [items, total] = await Promise.all([
    prisma.userFollow.findMany({
      where: { followingId: id },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userFollow.count({ where: { followingId: id } }),
  ])

  return {
    items: await Promise.all(items.map(async f => {
      const { email: _email, ...rest } = f.follower
      return { ...rest, avatar: await resolveAvatar(f.follower.avatar, f.follower.email) }
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(30),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { page, limit } = querySchema.parse(getQuery(event))
  const skip = (page - 1) * limit

  // 获取我关注的用户 ID 列表
  const following = await prisma.userFollow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  })

  if (following.length === 0) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    }
  }

  const followingIds = following.map(f => f.followingId)

  const where = { userId: { in: followingIds } }

  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activity.count({ where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

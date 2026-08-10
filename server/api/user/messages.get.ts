import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
  type: z.enum(['SYSTEM', 'COMMENT_REPLY', 'COMMENT_LIKE', 'OTHER']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const { page, limit, unreadOnly, type } = querySchema.parse(query)

  const skip = (page - 1) * limit

  // 根据用户NSFW模式筛选消息
  const nsfwFilter = user.nsfwMode === 'SFW'
    ? { isNsfw: false }
    : {}

  const whereClause: any = {
    receiverId: user.id,
    ...(unreadOnly && { isRead: false }),
    ...(type && { type }),
    ...nsfwFilter,
  }

  const [messages, total, unreadCount] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: whereClause }),
    prisma.message.count({
      where: {
        receiverId: user.id,
        isRead: false,
        ...nsfwFilter,
      },
    }),
  ])

  return {
    items: messages,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

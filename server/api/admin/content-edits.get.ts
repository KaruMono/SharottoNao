import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  targetType: z.enum(['GAME', 'COMPANY', 'GUIDE', 'RESOURCE']).optional(),
  targetId: z.coerce.number().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const { page, limit, targetType, targetId } = querySchema.parse(getQuery(event))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (targetType) where.targetType = targetType
  if (targetId) where.targetId = targetId

  const [items, total] = await Promise.all([
    prisma.contentEdit.findMany({
      where,
      include: {
        editor: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contentEdit.count({ where }),
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

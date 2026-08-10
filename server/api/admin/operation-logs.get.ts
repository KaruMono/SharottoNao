import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  adminId: z.coerce.number().optional(),
  action: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const query = getQuery(event)
  const { page, limit, adminId, action } = querySchema.parse(query)
  const skip = (page - 1) * limit

  const where: any = {
    ...(adminId && { adminId }),
    ...(action && { action: { contains: action, mode: 'insensitive' as const } }),
  }

  const [items, total] = await Promise.all([
    prisma.adminOperationLog.findMany({
      where,
      include: {
        admin: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.adminOperationLog.count({ where }),
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

import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const { page, limit, search } = querySchema.parse(query)
  const skip = (page - 1) * limit

  const where = search
    ? { ip: { contains: search } }
    : {}

  const [items, total] = await Promise.all([
    prisma.ipBlacklist.findMany({
      where,
      select: {
        id: true,
        ip: true,
        reason: true,
        createdAt: true,
        creator: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ipBlacklist.count({ where }),
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

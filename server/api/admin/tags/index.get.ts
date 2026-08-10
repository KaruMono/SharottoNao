import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  search: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  const { page, limit, search } = querySchema.parse(query)

  const where = search ? {
    name: { contains: search, mode: 'insensitive' as const },
  } : {}

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        isNsfw: true,
        _count: { select: { games: true } },
      },
      orderBy: { games: { _count: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ])

  return {
    items: tags.map(t => ({ ...t, gamesCount: t._count.games })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

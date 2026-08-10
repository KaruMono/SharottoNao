import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const query = getQuery(event)
  const { page, limit, search } = querySchema.parse(query)
  
  const skip = (page - 1) * limit

  const searchFilter = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { nameOriginal: { contains: search, mode: 'insensitive' as const } },
    ],
  } : {}

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where: searchFilter,
      include: {
        creator: {
          select: { id: true, username: true },
        },
        parent: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            games: { where: { game: { deletedAt: null } } },
            children: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.company.count({ where: searchFilter }),
  ])

  return {
    items: companies.map(c => ({
      ...c,
      gamesCount: c._count.games,
      childrenCount: c._count.children,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

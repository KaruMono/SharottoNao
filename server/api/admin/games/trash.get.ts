import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
})

function getDisplayTitle(game: { titleEn: string | null; titleJa: string | null; titleZhHans: string | null; titleZhHant: string | null }): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || ''
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const query = getQuery(event)
  const { page, limit, search } = querySchema.parse(query)
  const skip = (page - 1) * limit

  const where: any = {
    deletedAt: { not: null },
  }

  if (search) {
    where.OR = [
      { titleEn: { contains: search, mode: 'insensitive' as const } },
      { titleJa: { contains: search, mode: 'insensitive' as const } },
      { titleZhHans: { contains: search, mode: 'insensitive' as const } },
      { titleZhHant: { contains: search, mode: 'insensitive' as const } },
    ]
  }

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
        vndbId: true,
        bangumiId: true,
        deletedAt: true,
        createdAt: true,
        creator: {
          select: { id: true, username: true },
        },
        _count: {
          select: { resources: true, comments: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.game.count({ where }),
  ])

  return {
    items: games.map(g => ({
      ...g,
      title: getDisplayTitle(g),
      resourcesCount: g._count.resources,
      commentsCount: g._count.comments,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

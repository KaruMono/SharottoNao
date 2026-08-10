import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string | undefined
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20

  const nsfwMode = await getUserNsfwPreference(event)

  const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
    : nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}

  const where: any = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { nameOriginal: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...nsfwFilter,
  }

  const [items, total] = await Promise.all([
    prisma.gameSeries.findMany({
      where,
      include: {
        _count: { 
          select: { 
            games: {
              where: {
                deletedAt: null,
                ...nsfwFilter,
              },
            },
          },
        },
        games: {
          where: {
            deletedAt: null,
            ...nsfwFilter,
          },
          select: {
            id: true,
            titleZhHans: true,
            titleZhHant: true,
            titleJa: true,
            titleEn: true,
            coverImage: true,
          },
          take: 8,
          orderBy: { releaseDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gameSeries.count({ where }),
  ])

  return {
    items: items.map(s => ({
      ...s,
      gamesCount: s._count.games,
      games: s.games.map(g => ({
        ...g,
        title: g.titleZhHans || g.titleZhHant || g.titleJa || g.titleEn || `Game #${g.id}`,
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

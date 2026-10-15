import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'
import { buildTagVisibilityWhere } from '~/server/utils/tag-visibility'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { page, limit, search } = querySchema.parse(query)
  
  const skip = (page - 1) * limit
  const nsfwMode = await getUserNsfwPreference(event)

  const searchFilter = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { slug: { contains: search, mode: 'insensitive' as const } },
      { aliases: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
      { vndbTags: { some: { nameEn: { contains: search, mode: 'insensitive' as const } } } },
      { vndbTags: { some: { id: { contains: search, mode: 'insensitive' as const } } } },
    ],
  } : {}

  const visibilityFilter = buildTagVisibilityWhere(nsfwMode)
  const gameNsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
    : nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where: {
        ...searchFilter,
        ...visibilityFilter,
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        isNsfw: true,
        _count: {
          select: {
            games: {
              where: {
                game: {
                  deletedAt: null,
                  ...gameNsfwFilter,
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      skip: undefined,
      take: undefined,
    }),
    prisma.tag.count({ 
      where: {
        ...searchFilter,
        ...visibilityFilter,
      },
    }),
  ])

  const sortedTags = tags
    .sort((a, b) => b._count.games - a._count.games)
    .slice(skip, skip + limit)

  return {
    items: sortedTags.map(t => ({
      ...t,
      gamesCount: t._count.games,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'

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
    name: { contains: search, mode: 'insensitive' as const },
  } : {}

  // SFW 模式下过滤 NSFW 标签
  const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false } : {}

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where: {
        ...searchFilter,
        ...nsfwFilter,
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
                  ...nsfwFilter,
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
        ...nsfwFilter,
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

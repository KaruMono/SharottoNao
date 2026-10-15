import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { resolveGameTagDisplayTier } from '~/utils/tag-display-tier'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  search: z.string().optional(),
  archived: z.enum(['true', 'false']).default('false'),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const query = getQuery(event)
  const { page, limit, search, archived } = querySchema.parse(query)

  const where = {
    ...(archived === 'true' ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { aliases: { some: { name: { contains: search, mode: 'insensitive' as const } } } },
        { vndbTags: { some: { id: { contains: search, mode: 'insensitive' as const } } } },
        { vndbTags: { some: { nameEn: { contains: search, mode: 'insensitive' as const } } } },
      ],
    } : {}),
  }

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        isNsfw: true,
        isSystem: true,
        archivedAt: true,
        aliases: { select: { id: true, name: true, locale: true } },
        vndbTags: {
          select: { id: true, nameEn: true, displayTier: true },
          orderBy: { id: 'asc' },
        },
        _count: { select: { games: true } },
      },
      orderBy: { games: { _count: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ])

  return {
    items: tags.map(t => ({
      ...t,
      displayTier: resolveGameTagDisplayTier(t.vndbTags.map(vndbTag => ({
        source: 'VNDB',
        displayTier: vndbTag.displayTier,
      }))),
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

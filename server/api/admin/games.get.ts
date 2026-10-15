import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  isNsfw: z.enum(['true', 'false']).optional(),
  noResources: z.enum(['true']).optional(),
  missingCover: z.enum(['true']).optional(),
  missingDescription: z.enum(['true']).optional(),
  noTags: z.enum(['true']).optional(),
  missingExternalIds: z.enum(['true']).optional(),
  noVndb: z.enum(['true']).optional(),
  noBangumi: z.enum(['true']).optional(),
  noScreenshots: z.enum(['true']).optional(),
  duplicateResources: z.enum(['true']).optional(),
  noZhTitle: z.enum(['true']).optional(),
  noZhDesc: z.enum(['true']).optional(),
  hasMachineTranslation: z.enum(['true']).optional(),
  sortBy: z.enum(['views', 'resources', 'createdAt', 'releaseDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

function getDisplayTitle(game: { titleEn: string | null; titleJa: string | null; titleZhHans: string | null; titleZhHant: string | null }): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || ''
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const query = getQuery(event)
  const {
    page,
    limit,
    search,
    isNsfw,
    noResources,
    missingCover,
    missingDescription,
    noTags,
    missingExternalIds,
    noVndb,
    noBangumi,
    noScreenshots,
    duplicateResources,
    noZhTitle,
    noZhDesc,
    hasMachineTranslation,
    sortBy,
    sortOrder,
  } = querySchema.parse(query)
  
  const skip = (page - 1) * limit

  const andFilters: any[] = []
  if (search) {
    const aliasMatchIds = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Game"
      WHERE "deletedAt" IS NULL
      AND array_to_string(aliases, '||') ILIKE ${'%' + search + '%'}
    `
    const aliasIds = aliasMatchIds.map(r => r.id)
    andFilters.push({
      OR: [
        { titleEn: { contains: search, mode: 'insensitive' as const } },
        { titleJa: { contains: search, mode: 'insensitive' as const } },
        { titleZhHans: { contains: search, mode: 'insensitive' as const } },
        { titleZhHant: { contains: search, mode: 'insensitive' as const } },
        ...(aliasIds.length > 0 ? [{ id: { in: aliasIds } }] : []),
      ],
    })
  }

  if (missingCover === 'true') {
    andFilters.push({ OR: [{ coverImage: null }, { coverImage: '' }] })
  }

  const whereClause: any = {
    deletedAt: null,
    ...(andFilters.length > 0 && { AND: andFilters }),
    ...(isNsfw !== undefined && { isNsfw: isNsfw === 'true' }),
    ...(noResources === 'true' && {
      resources: { none: { deletedAt: null, status: 'APPROVED' } },
    }),
    ...(missingDescription === 'true' && {
      descriptionEn: null,
      descriptionJa: null,
      descriptionZhHans: null,
      descriptionZhHant: null,
    }),
    ...(noTags === 'true' && {
      tags: { none: {} },
    }),
    ...(missingExternalIds === 'true' && {
      vndbId: null,
      bangumiId: null,
    }),
    ...(noVndb === 'true' && { vndbId: null }),
    ...(noBangumi === 'true' && { bangumiId: null }),
    ...(noScreenshots === 'true' && {
      screenshots: { none: {} },
    }),
    ...(noZhTitle === 'true' && {
      titleZhHans: null,
      titleZhHant: null,
    }),
    ...(noZhDesc === 'true' && {
      descriptionZhHans: null,
      descriptionZhHant: null,
    }),
    ...(hasMachineTranslation === 'true' && {
      resources: {
        some: {
          isMachineTranslated: true,
          deletedAt: null,
          status: 'APPROVED',
        },
      },
    }),
  }

  if (duplicateResources === 'true') {
    const result: { gameId: number }[] = await prisma.$queryRaw`
      SELECT DISTINCT "gameId" FROM "Resource"
      WHERE "deletedAt" IS NULL
      GROUP BY "gameId", "typeId"
      HAVING COUNT(*) >= 2
    `
    whereClause.id = { in: result.map(r => r.gameId) }
  }

  // Keep the sort field whitelisted so arbitrary Prisma fields cannot be passed
  // through the admin endpoint.
  const orderBy: any = sortBy === 'views'
    ? { viewCount: sortOrder }
    : sortBy === 'resources'
      ? { resources: { _count: sortOrder } }
      : sortBy === 'releaseDate'
        ? { releaseDate: { sort: sortOrder, nulls: 'last' } }
        : { createdAt: sortOrder }

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where: whereClause,
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
        isNsfw: true,
        viewCount: true,
        createdAt: true,
        releaseDate: true,
        creator: {
          select: { id: true, username: true },
        },
        companies: {
          include: {
            company: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            resources: { where: { deletedAt: null } },
            comments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.game.count({ where: whereClause }),
  ])

  return {
    items: games.map(g => ({
      ...g,
      title: getDisplayTitle(g),
      company: g.companies[0]?.company || null,
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

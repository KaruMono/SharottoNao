import { z } from 'zod'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(12),
  search: z.string().optional(),
  index: z.string().max(1).optional(), // A-Z, #
  sort: z.enum(['games', 'name', 'founded']).default('games'),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { page, limit, search, index, sort } = querySchema.parse(query)
  
  const skip = (page - 1) * limit

  // 构建搜索条件 - 支持名称、原名、别名模糊搜索
  let searchFilter: any = {}
  if (search) {
    const compAliasIds = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Company"
      WHERE array_to_string(aliases, '||') ILIKE ${'%' + search + '%'}
    `
    const aliasIds = compAliasIds.map(r => r.id)
    searchFilter = {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { nameOriginal: { contains: search, mode: 'insensitive' as const } },
        ...(aliasIds.length > 0 ? [{ id: { in: aliasIds } }] : []),
      ],
    }
  }

  // 构建索引过滤
  const indexFilter = index ? { nameIndex: index.toUpperCase() } : {}

  // 构建排序
  const orderBy = sort === 'name'
    ? { name: 'asc' as const }
    : sort === 'founded'
    ? { foundedYear: 'desc' as const }
    : { id: 'asc' as const }

  const whereClause = {
    ...searchFilter,
    ...indexFilter,
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        nameOriginal: true,
        nameIndex: true,
        logo: true,
        aliases: true,
        description: true,
        website: true,
        foundedYear: true,
        _count: {
          select: {
            games: { where: { game: { deletedAt: null } } },
          },
        },
      },
      orderBy,
      skip: sort === 'games' ? undefined : skip,
      take: sort === 'games' ? undefined : limit,
    }),
    prisma.company.count({ where: whereClause }),
  ])

  const sortedCompanies = sort === 'games'
    ? companies
        .sort((a, b) => b._count.games - a._count.games)
        .slice(skip, skip + limit)
    : companies

  return {
    items: sortedCompanies.map(c => ({
      ...c,
      gamesCount: c._count.games,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

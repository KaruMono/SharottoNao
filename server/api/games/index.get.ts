import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getDisplayTitle } from '~/server/utils/game'
import { buildNsfwFilterFromUser, getUserNsfwPreference, type NsfwMode } from '~/server/utils/nsfw'
import { cachedFetch, CacheKeys, CacheTTL } from '~/server/utils/redis'
import { buildGameTagVisibilityWhere, buildTagVisibilityWhere } from '~/server/utils/tag-visibility'

// GameBump 表存在性只在进程内探测一次（数据库迁移后才有该表）
let hasBumpTablePromise: Promise<boolean> | null = null
function checkBumpTable(): Promise<boolean> {
  if (!hasBumpTablePromise) {
    hasBumpTablePromise = prisma.$queryRaw`SELECT 1 FROM "GameBump" LIMIT 1`
      .then(() => true)
      .catch(() => {
        // 探测失败不缓存结论，等迁移完成后能自动恢复
        hasBumpTablePromise = null
        return false
      })
  }
  return hasBumpTablePromise
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  search: z.string().optional(),
  companyId: z.coerce.number().optional(),
  tagId: z.coerce.number().optional(),
  // 支持多标签筛选（逗号分隔）
  tagIds: z.string().optional(),
  // 评分区间筛选
  ratingMin: z.coerce.number().min(1).max(5).optional(),
  ratingMax: z.coerce.number().min(1).max(5).optional(),
  // 资源平台筛选
  resourceTypeId: z.coerce.number().optional(),
  // 是否有资源
  hasResource: z.enum(['true', 'false']).optional(),
  // 是否有机翻资源
  hasMachineTranslation: z.enum(['true', 'false']).optional(),
  sort: z.enum(['latest', 'popular', 'release', 'updated', 'bump', 'rating']).default('bump'),
  order: z.enum(['asc', 'desc']).default('desc'),
  year: z.coerce.number().min(1980).max(2100).optional(),
  month: z.coerce.number().min(1).max(12).optional(),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = querySchema.parse(query)
  const nsfwMode = await getUserNsfwPreference(event)

  // 列表结果短缓存；游戏增删改时由 invalidateGameCaches 清除 games:*
  const cacheKey = CacheKeys.GAME_LIST(`${JSON.stringify(params)}:${nsfwMode}`)
  return cachedFetch(cacheKey, () => fetchGameList(params, nsfwMode), CacheTTL.SHORT)
})

async function fetchGameList(params: z.infer<typeof querySchema>, nsfwMode: NsfwMode) {
  const { page, limit, search, companyId, tagId, tagIds, ratingMin, ratingMax, resourceTypeId, hasResource, hasMachineTranslation, sort, order, year, month } = params
  const skip = (page - 1) * limit

  // 构建NSFW过滤
  const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
    : nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}
  const visibleGameTagWhere = buildGameTagVisibilityWhere(nsfwMode)

  // 构建搜索条件（搜索所有语言的标题 + 别名子串模糊匹配）
  let searchFilter: any = {}
  if (search) {
    const aliasMatchIds = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Game"
      WHERE "deletedAt" IS NULL
      AND array_to_string(aliases, '||') ILIKE ${'%' + search + '%'}
    `
    const aliasIds = aliasMatchIds.map(r => r.id)

    searchFilter = {
      OR: [
        { titleEn: { contains: search, mode: 'insensitive' as const } },
        { titleJa: { contains: search, mode: 'insensitive' as const } },
        { titleZhHans: { contains: search, mode: 'insensitive' as const } },
        { titleZhHant: { contains: search, mode: 'insensitive' as const } },
        ...(aliasIds.length > 0 ? [{ id: { in: aliasIds } }] : []),
      ],
    }
  }

  // 构建年份和月份过滤
  let dateFilter = {}
  if (year) {
    const startMonth = month || 1
    const endMonth = month || 12
    const startDate = new Date(year, startMonth - 1, 1)
    const endDate = new Date(year, endMonth, 0, 23, 59, 59) // 月份的最后一天
    dateFilter = {
      releaseDate: {
        gte: startDate,
        lte: endDate,
      },
    }
  }

  // 构建排序 - bump 排序需要特殊处理
  const sortDirection = order as 'asc' | 'desc'
  let orderBy: any = sort === 'latest' ? { createdAt: sortDirection }
    : sort === 'popular' ? { viewCount: sortDirection }
    : sort === 'release' ? { releaseDate: sortDirection }
    : sort === 'updated' ? { updatedAt: sortDirection }
    : { createdAt: sortDirection } // bump 排序的默认回退

  // 解析多标签筛选
  const parsedTagIds = tagIds 
    ? tagIds.split(',').map(Number).filter(n => !isNaN(n))
    : tagId ? [tagId] : []

  // 直接提交的标签 ID 也必须遵循当前公开可见性规则。
  if (parsedTagIds.length > 0) {
    // Archived tags are unavailable in every public mode. SFW additionally
    // rejects adult tags, including IDs supplied directly in the query.
    const tags = await prisma.tag.findMany({
      where: { id: { in: parsedTagIds }, ...buildTagVisibilityWhere(nsfwMode) },
      select: { id: true, isNsfw: true },
    })
    
    const requestedTagCount = new Set(parsedTagIds).size
    const hasUnavailableTag = tags.length !== requestedTagCount
    if (hasUnavailableTag) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }
    }
  }

  // 资源筛选：统一限定为已通过且未删除的资源，避免条件互相覆盖
  const resourceConditions: any = {
    deletedAt: null,
    status: 'APPROVED',
  }
  if (hasMachineTranslation === 'true') {
    resourceConditions.isMachineTranslated = true
  }
  if (resourceTypeId) {
    resourceConditions.typeId = resourceTypeId
  }

  if (hasResource === 'false' && (hasMachineTranslation === 'true' || resourceTypeId)) {
    throw createError({ statusCode: 400, message: '“无资源”不能和资源类型/机翻资源筛选同时使用' })
  }

  const resourceFilter: any = {}
  if (hasResource === 'true' || hasMachineTranslation === 'true' || resourceTypeId) {
    resourceFilter.resources = { some: resourceConditions }
  } else if (hasResource === 'false') {
    resourceFilter.resources = { none: resourceConditions }
  }

  const whereClause: any = {
    deletedAt: null,
    ...nsfwFilter,
    ...searchFilter,
    ...dateFilter,
    ...resourceFilter,
    ...(companyId && {
      companies: {
        some: { companyId },
      },
    }),
    // 多标签筛选（AND 关系：游戏需包含所有选择的标签）
    ...(parsedTagIds.length > 0 && {
      AND: parsedTagIds.map(tid => ({
        tags: { some: { tagId: tid } },
      })),
    }),
  }

  const buildRatingGroupArgs = () => {
    const avgScore: Record<string, number> = {}
    if (ratingMin !== undefined) avgScore.gte = ratingMin
    if (ratingMax !== undefined) avgScore.lte = ratingMax

    return {
      by: ['gameId'] as const,
      where: { game: { is: whereClause } },
      ...(Object.keys(avgScore).length > 0 ? { having: { score: { _avg: avgScore } } } : {}),
      _avg: { score: true },
      _count: { score: true },
    }
  }

  if (sort === 'rating') {
    const ratingGroupArgs = buildRatingGroupArgs()
    const [ratingRows, totalRows] = await Promise.all([
      (prisma.rating.groupBy as any)({
        ...ratingGroupArgs,
        orderBy: [{ _avg: { score: sortDirection } }, { gameId: 'asc' }],
        skip,
        take: limit,
      }),
      (prisma.rating.groupBy as any)(ratingGroupArgs),
    ]) as [any[], any[]]

    const sortedGameIds = ratingRows.map(row => row.gameId)
    if (sortedGameIds.length === 0) {
      return {
        items: [],
        pagination: { page, limit, total: totalRows.length, totalPages: Math.ceil(totalRows.length / limit) },
      }
    }

    const [games, ratingAvgs] = await Promise.all([
      prisma.game.findMany({
        where: { id: { in: sortedGameIds } },
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
          coverImage: true,
          releaseDate: true,
          isNsfw: true,
          viewCount: true,
          companies: {
            include: {
              company: {
                select: { id: true, name: true },
              },
            },
          },
          tags: {
            where: visibleGameTagWhere,
            select: {
              tag: {
                select: { id: true, name: true, color: true },
              },
            },
            take: 5,
          },
          _count: {
            select: { ratings: true },
          },
        },
      }),
      prisma.rating.groupBy({
        by: ['gameId'],
        where: { gameId: { in: sortedGameIds } },
        _avg: { score: true },
      }),
    ])

    const avgRatingByGameId = new Map(
      ratingAvgs.map((r) => [r.gameId, r._avg.score]),
    )
    const orderedGames = sortedGameIds.map(id => games.find(g => g.id === id)!).filter(Boolean)
    const gamesWithRating = orderedGames.map((game) => {
      const rawAvg = avgRatingByGameId.get(game.id)
      const avgRating = rawAvg != null ? Number(Number(rawAvg).toFixed(1)) : null

      return {
        ...game,
        title: getDisplayTitle(game),
        company: game.companies[0]?.company || null,
        tags: game.tags.map(t => t.tag),
        avgRating,
        ratingCount: game._count.ratings,
      }
    })

    return {
      items: gamesWithRating,
      pagination: {
        page,
        limit,
        total: totalRows.length,
        totalPages: Math.ceil(totalRows.length / limit),
      },
    }
  }

  if (ratingMin !== undefined || ratingMax !== undefined) {
    const ratingRows = await (prisma.rating.groupBy as any)(buildRatingGroupArgs()) as any[]
    const filteredRatingIds = ratingRows.map(row => row.gameId)
    if (filteredRatingIds.length === 0) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }
    }
    whereClause.id = { in: filteredRatingIds }
  }

  // 如果是 bump 排序，需要特殊处理
  if (sort === 'bump') {
    // 获取今日日期（只保留日期部分）
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 如果没有 bump 表，回退到按创建时间排序
    if (!(await checkBumpTable())) {
      orderBy = { createdAt: 'desc' as const }
    } else {
      // 顶数聚合在数据库完成，结果规模只与被顶过的游戏数相关
      const [totalBumpCounts, todayBumpCounts] = await Promise.all([
        prisma.gameBump.groupBy({
          by: ['gameId'],
          _count: true,
        }),
        prisma.gameBump.groupBy({
          by: ['gameId'],
          where: {
            bumpDate: today,
          },
          _count: true,
        }),
      ])

      const totalBumpMap = new Map(totalBumpCounts.map(b => [b.gameId, b._count]))
      const todayBumpMap = new Map(todayBumpCounts.map(b => [b.gameId, b._count]))
      const bumpedIds = [...totalBumpMap.keys()]

      // 只加载「被顶过且符合筛选」的游戏做内存排序，其余游戏按创建时间由数据库分页
      const [bumpedGames, total] = await Promise.all([
        bumpedIds.length > 0
          ? prisma.game.findMany({
              where: { AND: [whereClause, { id: { in: bumpedIds } }] },
              select: { id: true, createdAt: true },
            })
          : Promise.resolve([] as { id: number; createdAt: Date }[]),
        prisma.game.count({ where: whereClause }),
      ])

      // 排序：先按今日顶数，再按总顶数，最后按创建时间
      const sortedBumped = bumpedGames
        .map(g => ({
          id: g.id,
          todayBumps: todayBumpMap.get(g.id) || 0,
          totalBumps: totalBumpMap.get(g.id) || 0,
          createdAt: g.createdAt,
        }))
        .sort((a, b) => {
          if (b.todayBumps !== a.todayBumps) return b.todayBumps - a.todayBumps
          if (b.totalBumps !== a.totalBumps) return b.totalBumps - a.totalBumps
          return b.createdAt.getTime() - a.createdAt.getTime()
        })

      // 组装当前页：先取被顶过的游戏，不足的部分从未顶过的游戏（createdAt desc）补齐
      const sortedGameIds = sortedBumped
        .slice(skip, skip + limit)
        .map(g => g.id)

      const remaining = limit - sortedGameIds.length
      if (remaining > 0) {
        const nonBumped = await prisma.game.findMany({
          where: bumpedIds.length > 0
            ? { AND: [whereClause, { id: { notIn: bumpedIds } }] }
            : whereClause,
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          skip: Math.max(0, skip - sortedBumped.length),
          take: remaining,
        })
        sortedGameIds.push(...nonBumped.map(g => g.id))
      }

      if (sortedGameIds.length === 0) {
        return {
          items: [],
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
      }

      const [games, ratingAvgs] = await Promise.all([
        prisma.game.findMany({
          where: { id: { in: sortedGameIds } },
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
            coverImage: true,
            releaseDate: true,
            isNsfw: true,
            viewCount: true,
            companies: {
              include: {
                company: {
                  select: { id: true, name: true },
                },
              },
            },
            tags: {
              where: visibleGameTagWhere,
              select: {
                tag: {
                  select: { id: true, name: true, color: true },
                },
              },
              take: 5,
            },
            _count: {
              select: { ratings: true },
            },
          },
        }),
        prisma.rating.groupBy({
          by: ['gameId'],
          where: { gameId: { in: sortedGameIds } },
          _avg: { score: true },
        }),
      ])

      const avgRatingByGameId = new Map(
        ratingAvgs.map((r) => [r.gameId, r._avg.score]),
      )

      // 按原始顺序排序
      const orderedGames = sortedGameIds.map(id => games.find(g => g.id === id)!).filter(Boolean)

      // 计算平均评分（groupBy 聚合，避免加载每条评分记录）
      const gamesWithRating = orderedGames.map((game) => {
        const rawAvg = avgRatingByGameId.get(game.id)
        const avgRating =
          rawAvg != null ? Number(Number(rawAvg).toFixed(1)) : null

        return {
          ...game,
          title: getDisplayTitle(game),
          company: game.companies[0]?.company || null,
          tags: game.tags.map(t => t.tag),
          avgRating,
          ratingCount: game._count.ratings,
          todayBumps: todayBumpMap.get(game.id) || 0,
          totalBumps: totalBumpMap.get(game.id) || 0,
        }
      })

      return {
        items: gamesWithRating,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    }
  }

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
        releaseDate: true,
        isNsfw: true,
        viewCount: true,
        companies: {
          include: {
            company: {
              select: { id: true, name: true },
            },
          },
        },
        tags: {
          where: visibleGameTagWhere,
          select: {
            tag: {
              select: { id: true, name: true, color: true },
            },
          },
          take: 5,
        },
        _count: {
          select: { ratings: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.game.count({ where: whereClause }),
  ])

  const gameIds = games.map((g) => g.id)
  const ratingAvgs =
    gameIds.length === 0
      ? []
      : await prisma.rating.groupBy({
          by: ['gameId'],
          where: { gameId: { in: gameIds } },
          _avg: { score: true },
        })
  const avgRatingByGameId = new Map(
    ratingAvgs.map((r) => [r.gameId, r._avg.score]),
  )

  // 平均评分由单次 groupBy 聚合得到，避免加载每条评分记录
  const gamesWithRating = games.map((game) => {
    const rawAvg = avgRatingByGameId.get(game.id)
    const avgRating =
      rawAvg != null ? Number(Number(rawAvg).toFixed(1)) : null

    return {
      ...game,
      title: getDisplayTitle(game),
      company: game.companies[0]?.company || null,
      tags: game.tags.map(t => t.tag),
      avgRating,
      ratingCount: game._count.ratings,
    }
  })

  return {
    items: gamesWithRating,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

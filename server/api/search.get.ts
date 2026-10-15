import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getDisplayTitle } from '~/server/utils/game'
import { buildNsfwFilterFromUser } from '~/server/utils/nsfw'
import { cachedFetch } from '~/server/utils/redis'
import pinyinModule from 'pinyin'
import { buildTagVisibilityWhere } from '~/server/utils/tag-visibility'

const pinyin = (pinyinModule as any).default || pinyinModule
const searchTypes = ['all', 'games', 'companies', 'tags', 'staff'] as const

function normalizeSearchType(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === 'game') return 'games'
  if (raw === 'company') return 'companies'
  if (raw === 'tag') return 'tags'
  return raw
}

const querySchema = z.object({
  q: z.string().min(1),
  type: z.preprocess(normalizeSearchType, z.enum(searchTypes).default('all')),
  limit: z.coerce.number().min(1).max(20).default(10),
  page: z.coerce.number().min(1).default(1),
  sort: z.enum(['relevance', 'rating', 'popular', 'latest']).default('relevance'),
})

/**
 * 将搜索关键词转为拼音以支持拼音搜索
 */
function toPinyin(text: string): string {
  const hasChinese = /[\u4e00-\u9fa5]/.test(text)
  if (!hasChinese) return text

  try {
    const result = pinyin(text, {
      style: pinyin.STYLE_NORMAL,
      heteronym: false,
    })
    return result.flat().join('')
  } catch {
    return text
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.errors[0]?.message || '参数错误' })
  }
  const { q, type, limit, page, sort } = parsed.data
  
  const user = await getAuthUser(event)
  const nsfwFilter = buildNsfwFilterFromUser(user)
  const nsfwMode = user?.nsfwMode || 'SFW'
  const tagVisibilityFilter = buildTagVisibilityWhere(nsfwMode)

  // 使用缓存（按搜索词+类型+NSFW模式+分页缓存，30秒）
  const cacheKey = `search:${q}:${type}:${sort}:${nsfwMode}:${limit}:${page}`

  return cachedFetch(cacheKey, async () => {
    // 生成拼音搜索词
    const pinyinQ = toPinyin(q)

    const results: {
      games?: { items: any[]; total: number; totalPages: number; page: number }
      companies?: { items: any[]; total: number; totalPages: number; page: number }
      tags?: { items: any[]; total: number; totalPages: number; page: number }
      staff?: { items: any[]; total: number; totalPages: number; page: number }
    } = {}

    const skip = (page - 1) * limit

    // 搜索游戏
    if (type === 'all' || type === 'games' || type === 'staff') {
      // 构建排序
      let orderBy: any = { viewCount: 'desc' as const } // 默认按热度
      if (sort === 'latest') orderBy = { createdAt: 'desc' as const }

      // 别名模糊匹配：用 raw SQL 查找别名数组中包含搜索词的游戏 ID
      const aliasMatchIds = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Game"
        WHERE "deletedAt" IS NULL
        AND array_to_string(aliases, '||') ILIKE ${'%' + q + '%'}
      `
      const aliasIds = aliasMatchIds.map(r => r.id)

      const gameWhere: any = {
        deletedAt: null,
        ...nsfwFilter,
        OR: [
          { titleEn: { contains: q, mode: 'insensitive' as const } },
          { titleJa: { contains: q, mode: 'insensitive' as const } },
          { titleZhHans: { contains: q, mode: 'insensitive' as const } },
          { titleZhHant: { contains: q, mode: 'insensitive' as const } },
          // 别名子串模糊匹配
          ...(aliasIds.length > 0 ? [{ id: { in: aliasIds } }] : []),
          // 拼音搜索（仅在拼音和原始词不同时）
          ...(pinyinQ !== q ? [
            { titleZhHans: { contains: pinyinQ, mode: 'insensitive' as const } },
          ] : []),
          // 搜索STAFF
          {
            staff: {
              some: {
                staff: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { nameOriginal: { contains: q, mode: 'insensitive' as const } },
                  ],
                },
              },
            },
          },
          // 搜索标签
          {
            tags: {
              some: {
                tag: {
                  ...tagVisibilityFilter,
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { slug: { contains: q, mode: 'insensitive' as const } },
                    { aliases: { some: { name: { contains: q, mode: 'insensitive' as const } } } },
                    { vndbTags: { some: { nameEn: { contains: q, mode: 'insensitive' as const } } } },
                  ],
                },
              },
            },
          },
          // 资源名称命中时返回所属游戏条目，避免把下载资源单独暴露成搜索结果。
          {
            resources: {
              some: {
                deletedAt: null,
                status: 'APPROVED' as any,
                title: { contains: q, mode: 'insensitive' as const },
              },
            },
          },
        ],
      }

      const gameSelect = {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
        isNsfw: true,
        viewCount: true,
        companies: {
          include: {
            company: {
              select: { id: true, name: true },
            },
          },
          take: 1 as const,
        },
      }

      let gamesTotal: number
      let sortedGames: any[]

      if (sort === 'rating') {
        // 评分在数据库聚合（每游戏一行），只对有评分的匹配游戏排序，未评分的按热度补齐
        const [total, ratingRows] = await Promise.all([
          prisma.game.count({ where: gameWhere }),
          prisma.rating.groupBy({
            by: ['gameId'],
            where: { game: { is: gameWhere } },
            _avg: { score: true },
          }),
        ])
        gamesTotal = total

        const ratedSortedIds = ratingRows
          .sort((a, b) => (b._avg.score || 0) - (a._avg.score || 0))
          .map(r => r.gameId)

        const pageIds = ratedSortedIds.slice(skip, skip + limit)
        const remaining = limit - pageIds.length
        if (remaining > 0) {
          const unrated = await prisma.game.findMany({
            where: ratedSortedIds.length > 0
              ? { AND: [gameWhere, { id: { notIn: ratedSortedIds } }] }
              : gameWhere,
            select: { id: true },
            orderBy: { viewCount: 'desc' },
            skip: Math.max(0, skip - ratedSortedIds.length),
            take: remaining,
          })
          pageIds.push(...unrated.map(g => g.id))
        }

        const pageGames = pageIds.length > 0
          ? await prisma.game.findMany({
              where: { id: { in: pageIds } },
              select: gameSelect,
            })
          : []
        sortedGames = pageIds.map(id => pageGames.find(g => g.id === id)!).filter(Boolean)
      } else {
        const [total, games] = await Promise.all([
          prisma.game.count({ where: gameWhere }),
          prisma.game.findMany({
            where: gameWhere,
            select: gameSelect,
            orderBy,
            skip,
            take: limit,
          }),
        ])
        gamesTotal = total
        sortedGames = games
      }

      const gamesTotalPages = Math.ceil(gamesTotal / limit)
      results.games = {
        items: sortedGames.map(g => ({
          id: g.id,
          title: getDisplayTitle(g),
          coverImage: g.coverImage,
          isNsfw: g.isNsfw,
          company: g.companies[0]?.company || null,
        })),
        total: gamesTotal,
        totalPages: gamesTotalPages,
        page,
      }
    }

    // 搜索会社
    if (type === 'all' || type === 'companies') {
      const companyAliasIds = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Company"
        WHERE array_to_string(aliases, '||') ILIKE ${'%' + q + '%'}
      `
      const compAliasIds = companyAliasIds.map(r => r.id)

      const companyWhere = {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { nameOriginal: { contains: q, mode: 'insensitive' as const } },
              ...(compAliasIds.length > 0 ? [{ id: { in: compAliasIds } }] : []),
            ],
          },
          { games: { some: { game: { deletedAt: null, ...nsfwFilter } } } },
        ],
      }

      const [companiesTotal, companies] = await Promise.all([
        prisma.company.count({ where: companyWhere }),
        prisma.company.findMany({
          where: companyWhere,
          select: {
            id: true,
            name: true,
            nameOriginal: true,
            logo: true,
            _count: {
              select: {
                games: { where: { game: { deletedAt: null, ...nsfwFilter } } },
              },
            },
          },
          skip,
          take: limit,
        }),
      ])

      const companiesTotalPages = Math.ceil(companiesTotal / limit)
      results.companies = {
        items: companies,
        total: companiesTotal,
        totalPages: companiesTotalPages,
        page,
      }
    }

    // 搜索标签
    if (type === 'all' || type === 'tags') {
      const tagWhere = {
        ...tagVisibilityFilter,
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
          { aliases: { some: { name: { contains: q, mode: 'insensitive' as const } } } },
          { vndbTags: { some: { nameEn: { contains: q, mode: 'insensitive' as const } } } },
          { vndbTags: { some: { id: { contains: q, mode: 'insensitive' as const } } } },
        ],
      }

      const [tagsTotal, tags] = await Promise.all([
        prisma.tag.count({ where: tagWhere }),
        prisma.tag.findMany({
          where: tagWhere,
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            _count: {
              select: {
                games: { where: { game: { deletedAt: null, ...nsfwFilter } } },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
      ])

      const sortedTags = tags
        .sort((a, b) => b._count.games - a._count.games)
        .slice(skip, skip + limit)

      const tagsTotalPages = Math.ceil(tagsTotal / limit)
      results.tags = {
        items: sortedTags,
        total: tagsTotal,
        totalPages: tagsTotalPages,
        page,
      }
    }

    // 搜索 Staff
    if (type === 'all' || type === 'staff') {
      const staffWhere = {
        AND: [
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { nameOriginal: { contains: q, mode: 'insensitive' as const } },
            ],
          },
          { games: { some: { game: { deletedAt: null, ...nsfwFilter } } } },
        ],
      }

      const [staffTotal, staffItems] = await Promise.all([
        prisma.staff.count({ where: staffWhere }),
        prisma.staff.findMany({
          where: staffWhere,
          select: {
            id: true,
            name: true,
            nameOriginal: true,
            avatar: true,
            games: {
              where: { game: { deletedAt: null, ...nsfwFilter } },
              select: { role: true },
            },
            _count: {
              select: {
                games: { where: { game: { deletedAt: null, ...nsfwFilter } } },
              },
            },
          },
          skip,
          take: limit,
        }),
      ])

      results.staff = {
        items: staffItems.map(item => ({
          id: item.id,
          name: item.name,
          nameOriginal: item.nameOriginal,
          avatar: item.avatar,
          gamesCount: item._count.games,
          roles: [...new Set(item.games.map(game => game.role))],
        })),
        total: staffTotal,
        totalPages: Math.ceil(staffTotal / limit),
        page,
      }
    }

    return results
  }, 30) // 缓存 30 秒
})

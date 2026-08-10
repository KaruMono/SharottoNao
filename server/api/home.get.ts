import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getSiteName, getSiteDescription, getSetting, getHomeTitle } from '~/server/utils/settings'
import { cachedFetch, CacheKeys, CacheTTL } from '~/server/utils/redis'
import { getDisplayTitle, getNsfwMode } from '~/server/utils/game'
import { getCurrentMonthRange } from '~/server/utils/vndb-monthly-release'
import { getTrafficStats } from '~/server/utils/traffic'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)

  // 根据用户 NSFW 模式确定缓存键
  const nsfwMode = getNsfwMode(user)
  const cacheKey = CacheKeys.HOME_DATA(nsfwMode)

  // 使用 Redis 缓存（如果可用）
  return cachedFetch(cacheKey, async () => {
    // 构建NSFW过滤
    const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
      : nsfwMode === 'NSFW' ? { isNsfw: true }
      : {}

    const gameSelect = {
      id: true,
      titleEn: true,
      titleJa: true,
      titleZhHans: true,
      titleZhHant: true,
      coverImage: true,
      releaseDate: true,
      isNsfw: true,
    }
    const currentMonthRange = getCurrentMonthRange()

    // 并行获取各类数据
    const [
      siteName,
      siteDescription,
      homeTitle,
      favicon,
      touchIcon,
      headerScripts,
      footerScripts,
      footerHtml,
      customMetaTags,
      monthlyReleasedGames,
      latestGames,
      recentlyUpdated,
      popularGames,
      tags,
      recentEdits,
      friendLinks,
      announcement,
      recentComments,
      traffic,
    ] = await Promise.all([
      getSiteName(),
      getSiteDescription(),
      getHomeTitle(),
      getSetting('favicon'),
      getSetting('touch_icon'),
      getSetting('header_scripts'),
      getSetting('footer_scripts'),
      getSetting('footer_html'),
      getSetting('custom_meta_tags'),
      // 本月发布（按发售日排序）
      prisma.game.findMany({
        where: {
          deletedAt: null,
          releaseDate: {
            gte: currentMonthRange.start,
            lte: currentMonthRange.end,
          },
          ...nsfwFilter,
        },
        select: gameSelect,
        orderBy: { releaseDate: 'asc' },
        take: 10,
      }),
      // 最新创建
      prisma.game.findMany({
        where: { deletedAt: null, ...nsfwFilter },
        select: gameSelect,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 最新上传（按最新添加资源的时间排序）
      prisma.resource.findMany({
        where: { deletedAt: null, status: 'APPROVED' },
        select: {
          createdAt: true,
          game: {
            select: gameSelect,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20, // 多取一些以便去重
        distinct: ['gameId'], // 每个游戏只取一条
      }).then(resources => 
        resources
          .filter(r => {
            if (nsfwMode === 'SFW') return !r.game.isNsfw
            if (nsfwMode === 'NSFW') return r.game.isNsfw
            return true // ALL 模式不过滤
          })
          .slice(0, 10)
          .map(r => r.game)
      ),
      // 热门推荐
      prisma.game.findMany({
        where: { deletedAt: null, ...nsfwFilter },
        select: gameSelect,
        orderBy: { viewCount: 'desc' },
        take: 10,
      }),
      // 标签云
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          color: true,
          _count: {
            select: {
              games: { where: { game: { deletedAt: null, ...nsfwFilter } } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: 20,
      }),
      // 最近编辑（从 Activity 表获取）
      prisma.activity.findMany({
        where: {
          type: { in: ['CREATE_GAME', 'EDIT_GAME'] },
          targetType: 'game',
        },
        include: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).then(async (activities) => {
        const gameIds = [...new Set(activities.map(a => a.targetId).filter(Boolean))] as number[]
        const games = await prisma.game.findMany({
          where: { id: { in: gameIds }, deletedAt: null },
          select: { id: true, titleEn: true, titleJa: true, titleZhHans: true, titleZhHant: true, isNsfw: true },
        })
        const gameMap = new Map(games.map(g => [g.id, g]))
        return activities
          .map(a => ({ ...a, game: gameMap.get(a.targetId!) }))
          .filter(a => a.game)
      }),
      // 友情链接
      prisma.friendLink.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      // 侧边栏公告（从 SiteConfig 获取）
      prisma.siteConfig.findUnique({ where: { key: 'announcement_sidebar' } }),
      // 最近评论
      prisma.comment.findMany({
        where: {
          deletedAt: null,
          parentId: null,
          game: { deletedAt: null },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, username: true, avatar: true } },
          game: {
            select: {
              id: true,
              titleEn: true,
              titleJa: true,
              titleZhHans: true,
              titleZhHant: true,
              isNsfw: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // 下载流量（今日 + 近一周）
      getTrafficStats(),
    ])

    const filteredEdits = recentEdits.filter(edit => {
      if (!edit.game) return false
      if (nsfwMode === 'SFW') return !edit.game.isNsfw
      if (nsfwMode === 'NSFW') return edit.game.isNsfw
      return true
    }).slice(0, 5)

    // 处理游戏列表，添加显示标题
    const processGames = (games: typeof latestGames) => games.map(g => ({
      ...g,
      title: getDisplayTitle(g),
    }))

    return {
      siteName,
      homeTitle,
      siteDescription,
      favicon: favicon || '',
      touchIcon: touchIcon || '',
      headerScripts: headerScripts || '',
      footerScripts: footerScripts || '',
      footerHtml: footerHtml || '',
      customMetaTags: customMetaTags || '',
      monthlyReleasedGames: processGames(monthlyReleasedGames),
      latestGames: processGames(latestGames),
      recentlyUpdated: processGames(recentlyUpdated),
      popularGames: processGames(popularGames),
      tags: tags
        .map(t => ({
          ...t,
          gamesCount: t._count.games,
        }))
        .filter(t => t.gamesCount > 0)
        .sort((a, b) => b.gamesCount - a.gamesCount)
        .slice(0, 20),
      recentEdits: filteredEdits.map(e => ({
        id: e.id,
        action: e.type === 'CREATE_GAME' ? '新建条目' : '更新条目信息',
        createdAt: e.createdAt,
        user: e.user,
        game: { id: e.game!.id, title: getDisplayTitle(e.game!) },
      })),
      recentComments: recentComments
        .filter(c => {
          if (nsfwMode === 'SFW') return !c.game.isNsfw
          if (nsfwMode === 'NSFW') return c.game.isNsfw
          return true
        })
        .slice(0, 6)
        .map(c => ({
          id: c.id,
          content: c.content.replace(/<[^>]*>/g, '').slice(0, 80),
          createdAt: c.createdAt,
          user: c.user,
          game: { id: c.game.id, title: getDisplayTitle(c.game) },
        })),
      friendLinks,
      traffic,
      announcement: (() => {
        if (!announcement?.value) return null
        try {
          const parsed = JSON.parse(announcement.value)
          return parsed.isActive ? parsed.content : null
        } catch {
          return null
        }
      })(),
    }
  }, CacheTTL.SHORT) // 缓存 60 秒
})

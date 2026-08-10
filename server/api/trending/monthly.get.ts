import prisma from '~/server/utils/prisma'
import { cachedFetch, CacheTTL } from '~/server/utils/redis'

const gameSelect = {
  id: true,
  titleZhHans: true,
  titleJa: true,
  titleEn: true,
  coverImage: true,
  releaseDate: true,
  viewCount: true,
  companies: {
    where: {
      role: 'DEVELOPER' as const,
    },
    select: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 1,
  },
}

function formatGame(game: any) {
  return {
    id: game.id,
    title: game.titleZhHans || game.titleJa || game.titleEn || '未知游戏',
    coverImage: game.coverImage,
    releaseDate: game.releaseDate,
    year: game.releaseDate ? new Date(game.releaseDate).getFullYear() : null,
    viewCount: game.viewCount,
    company: game.companies[0]?.company || null,
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 5

  return cachedFetch(`trending:monthly:${limit}`, async () => {
    // 获取本月开始时间
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    try {
      // 以本月「顶一下」数作为月度热度信号（viewCount 是历史累计值，没有按月数据）
      const monthlyBumps = await prisma.gameBump.groupBy({
        by: ['gameId'],
        where: { createdAt: { gte: monthStart } },
        _count: true,
      })

      const bumpedIdsSorted = monthlyBumps
        .sort((a, b) => (b._count as number) - (a._count as number))
        .map(b => b.gameId)

      const bumpedGames = bumpedIdsSorted.length > 0
        ? await prisma.game.findMany({
            where: { id: { in: bumpedIdsSorted.slice(0, limit) }, deletedAt: null },
            select: gameSelect,
          })
        : []

      // 按本月顶数排序
      const orderedBumped = bumpedIdsSorted
        .map(id => bumpedGames.find(g => g.id === id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
        .slice(0, limit)

      // 本月热度数据不足时，用总浏览量最高的游戏补齐
      const remaining = limit - orderedBumped.length
      let fillGames: typeof orderedBumped = []
      if (remaining > 0) {
        fillGames = await prisma.game.findMany({
          where: {
            deletedAt: null,
            ...(orderedBumped.length > 0
              ? { id: { notIn: orderedBumped.map(g => g.id) } }
              : {}),
          },
          select: gameSelect,
          orderBy: { viewCount: 'desc' },
          take: remaining,
        })
      }

      return [...orderedBumped, ...fillGames].map(formatGame)
    } catch (err) {
      console.error('获取本月热门游戏失败:', err)
      return []
    }
  }, CacheTTL.MEDIUM)
})

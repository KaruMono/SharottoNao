import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的系列ID',
    })
  }

  const nsfwMode = await getUserNsfwPreference(event)

  const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
    : nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}

  const series = await prisma.gameSeries.findUnique({
    where: { id },
    include: {
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
          isNsfw: true,
          releaseDate: true,
          _count: {
            select: { ratings: true },
          },
        },
        orderBy: {
          releaseDate: 'desc',
        },
      },
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
    },
  })

  if (!series) {
    throw createError({
      statusCode: 404,
      message: '系列不存在',
    })
  }

  // SFW 模式下不显示 NSFW 系列
  if (nsfwMode === 'SFW' && series.isNsfw) {
    throw createError({
      statusCode: 404,
      message: '系列不存在',
    })
  }

  const gameIds = series.games.map((g) => g.id)
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

  // 转换游戏标题并计算平均评分（groupBy 聚合，避免加载每条评分）
  const gamesWithTitle = series.games.map((game) => {
    const rawAvg = avgRatingByGameId.get(game.id)
    const avgRating =
      rawAvg != null ? Number(Number(rawAvg).toFixed(1)) : null

    return {
      ...game,
      title:
        game.titleZhHans ||
        game.titleZhHant ||
        game.titleJa ||
        game.titleEn ||
        `Game #${game.id}`,
      avgRating,
      ratingCount: game._count.ratings,
    }
  })

  return {
    ...series,
    games: gamesWithTitle,
  }
})

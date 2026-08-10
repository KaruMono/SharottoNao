import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getDisplayTitle, getNsfwMode } from '~/server/utils/game'
import { buildNsfwFilterFromUser } from '~/server/utils/nsfw'
import { cachedFetch, CacheTTL } from '~/server/utils/redis'

const querySchema = z.object({
  year: z.coerce.number().min(2000).max(2100),
  month: z.coerce.number().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, month } = querySchema.parse(query)

  const user = await getAuthUser(event)
  const nsfwFilter = buildNsfwFilterFromUser(user)
  const nsfwMode = getNsfwMode(user)

  const cacheKey = `calendar:${year}:${month}:${nsfwMode}`

  return cachedFetch(cacheKey, async () => {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    const games = await prisma.game.findMany({
      where: {
        deletedAt: null,
        releaseDate: {
          gte: startDate,
          lte: endDate,
        },
        ...nsfwFilter,
      },
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
        isNsfw: true,
        releaseDate: true,
      },
      orderBy: { releaseDate: 'asc' },
    })

    // Group by date string
    const groupMap = new Map<string, { id: number; title: string; coverImage: string | null; isNsfw: boolean }[]>()

    for (const game of games) {
      const dateStr = game.releaseDate!.toISOString().slice(0, 10)
      if (!groupMap.has(dateStr)) {
        groupMap.set(dateStr, [])
      }
      groupMap.get(dateStr)!.push({
        id: game.id,
        title: getDisplayTitle(game),
        coverImage: game.coverImage,
        isNsfw: game.isNsfw,
      })
    }

    // Sort date groups ascending
    const sortedDates = [...groupMap.keys()].sort()

    return {
      year,
      month,
      games: sortedDates.map(date => ({
        date,
        games: groupMap.get(date)!,
      })),
    }
  }, CacheTTL.MEDIUM)
})

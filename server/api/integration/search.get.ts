import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import prisma from '../../utils/prisma'
import { getDisplayTitle } from '../../utils/game'
import { cachedFetch } from '../../utils/redis'
import { isRateLimited } from '../../utils/rate-limit'
import { requireSearchgalApiKey, searchgalIncludesNsfw, searchgalQuerySchema } from '../../utils/searchgal-api'
import { buildSearchgalSearchQuery, type SearchgalGameRow } from '../../utils/searchgal-search'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  requireSearchgalApiKey(event)

  if (await isRateLimited(event, 'searchgal', {
    windowSeconds: 60,
    maxRequests: 120,
    keyPrefix: 'integration:search:v1',
  })) {
    setHeader(event, 'Retry-After', 60)
    throw createError({ statusCode: 429, message: '请求过于频繁，请稍后再试' })
  }

  const parsed = searchgalQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: '搜索参数错误：q 须为 1～100 个字符，limit 须为 1～20 的整数，仅支持 q 和 limit' })
  }

  const { q, limit } = parsed.data
  const includeNsfw = searchgalIncludesNsfw(useRuntimeConfig().searchgalIncludeNsfw)
  // Preserve Unicode/case for PostgreSQL's case folding; trim is the normalization.
  const cacheKey = `search:integration:v1:${JSON.stringify([q, limit, includeNsfw])}`
  try {
    return await cachedFetch(cacheKey, async () => {
      const games = await prisma.$queryRaw<SearchgalGameRow[]>(buildSearchgalSearchQuery(q, limit, includeNsfw))
      return {
        items: games.map(game => ({
          id: game.id,
          title: getDisplayTitle(game),
          path: `/games/${game.id}`,
          isNsfw: game.isNsfw,
        })),
      }
    }, 60)
  } catch {
    throw createError({ statusCode: 500, message: '游戏搜索失败，请稍后再试' })
  }
})

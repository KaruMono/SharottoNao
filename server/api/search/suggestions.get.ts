import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getDisplayTitle } from '~/server/utils/game'
import { buildNsfwFilterFromUser } from '~/server/utils/nsfw'
import { cachedFetch } from '~/server/utils/redis'

const querySchema = z.object({
  q: z.string().min(1).max(50),
  limit: z.coerce.number().min(1).max(10).default(5),
})

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.errors[0]?.message || '参数错误' })
  }
  const { q, limit } = parsed.data
  const user = await getAuthUser(event)
  const nsfwFilter = buildNsfwFilterFromUser(user)
  const nsfwMode = user?.nsfwMode || 'SFW'

  const cacheKey = `suggest:${q}:${nsfwMode}:${limit}`

  return cachedFetch(cacheKey, async () => {
    // 别名模糊匹配
    const aliasMatchIds = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Game"
      WHERE "deletedAt" IS NULL
      AND array_to_string(aliases, '||') ILIKE ${'%' + q + '%'}
    `
    const aliasIds = aliasMatchIds.map(r => r.id)

    const games = await prisma.game.findMany({
      where: {
        ...nsfwFilter,
        deletedAt: null,
        OR: [
          { titleEn: { startsWith: q, mode: 'insensitive' } },
          { titleJa: { startsWith: q, mode: 'insensitive' } },
          { titleZhHans: { startsWith: q, mode: 'insensitive' } },
          { titleZhHant: { startsWith: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
          { titleJa: { contains: q, mode: 'insensitive' } },
          { titleZhHans: { contains: q, mode: 'insensitive' } },
          { titleZhHant: { contains: q, mode: 'insensitive' } },
          ...(aliasIds.length > 0 ? [{ id: { in: aliasIds } }] : []),
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
      },
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    })

    return games.map(g => ({
      id: g.id,
      title: getDisplayTitle(g),
      coverImage: g.coverImage,
    }))
  }, 30) // 缓存 30 秒
})

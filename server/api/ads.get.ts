import prisma from '~/server/utils/prisma'
import { cachedFetch, CacheTTL } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const slot = query.slot as string | undefined

  const cacheKey = slot ? `ads:${slot}` : 'ads:all'

  return cachedFetch(cacheKey, async () => {
    const where: any = { enabled: true }
    if (slot) where.slot = slot

    return prisma.advertisement.findMany({
      where,
      select: {
        id: true,
        slot: true,
        name: true,
        icon: true,
        imageUrl: true,
        linkUrl: true,
        openInNewTab: true,
      },
      orderBy: { sortOrder: 'asc' },
    })
  }, CacheTTL.SHORT)
})

import prisma from '~/server/utils/prisma'
import { cachedFetch, CacheTTL } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const categorySlug = query.category as string | undefined

  // 按分类参数分别缓存（routeRules 的 swr 不区分 query string，不能用在这里）
  return cachedFetch(`tools:${categorySlug || 'all'}`, async () => {
    const where = categorySlug
      ? { category: { slug: categorySlug } }
      : undefined

    const tools = await prisma.tool.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
    })

    return tools
  }, CacheTTL.LONG)
})

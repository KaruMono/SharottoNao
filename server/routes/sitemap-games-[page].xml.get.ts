import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml, URLS_PER_SITEMAP } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    // 从路由参数中提取页码，例如 /sitemap-games-1.xml 中的 "1"
    const rawPage = (event.context.params?.page as string) ?? '1'
    const page = Math.max(1, parseInt(rawPage) || 1)
    const skip = (page - 1) * URLS_PER_SITEMAP

    const games = await prisma.game.findMany({
      where: { isNsfw: false, deletedAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
      skip,
      take: URLS_PER_SITEMAP,
    })

    if (games.length === 0) {
      throw createError({ statusCode: 404, message: 'Sitemap page not found' })
    }

    const urls = games.map(g =>
      urlEntry(`${siteUrl}/games/${g.id}`, {
        lastmod: g.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.8',
      })
    )

    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error: any) {
    if (error.statusCode === 404) throw error
    console.error('[sitemap-games] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

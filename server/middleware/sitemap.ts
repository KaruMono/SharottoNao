import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml, URLS_PER_SITEMAP } from '~/server/utils/sitemap'

// 仅处理分页 games sitemap: /sitemap-games-{N}.xml
const gamesPattern = /^\/sitemap-games-(\d+)\.xml$/

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  const match = path.match(gamesPattern)
  if (!match) return

  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')
    const pageNum = parseInt(match[1])
    if (pageNum < 1) {
      throw createError({ statusCode: 404, message: 'Sitemap not found' })
    }

    const gameCount = await prisma.game.count({
      where: { isNsfw: false, deletedAt: null },
    })
    const maxPage = Math.max(1, Math.ceil(gameCount / URLS_PER_SITEMAP))
    if (pageNum > maxPage) {
      throw createError({ statusCode: 404, message: 'Sitemap not found' })
    }

    const skip = (pageNum - 1) * URLS_PER_SITEMAP
    const games = await prisma.game.findMany({
      where: { isNsfw: false, deletedAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
      skip,
      take: URLS_PER_SITEMAP,
    })
    const urls = games.map(g =>
      urlEntry(`${siteUrl}/games/${g.id}`, {
        lastmod: g.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.8',
      })
    )
    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-games] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

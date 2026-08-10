import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    const gamesWithGuides = await prisma.guide.findMany({
      where: { game: { isNsfw: false, deletedAt: null } },
      select: { gameId: true, updatedAt: true },
      distinct: ['gameId'],
      orderBy: { updatedAt: 'desc' },
    })
    const urls = gamesWithGuides.map(g =>
      urlEntry(`${siteUrl}/games/${g.gameId}/guides`, {
        lastmod: g.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.6',
      })
    )
    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-guides] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

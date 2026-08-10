import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    const series = await prisma.gameSeries.findMany({
      where: {
        isNsfw: false,
        games: {
          some: {
            isNsfw: false,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    })

    const urls = series.map(s =>
      urlEntry(`${siteUrl}/series/${s.id}`, {
        lastmod: s.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.7',
      })
    )

    // 添加系列列表页
    urls.unshift(urlEntry(`${siteUrl}/series`, {
      changefreq: 'daily',
      priority: '0.8',
    }))

    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-series] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    const companies = await prisma.company.findMany({
      where: {
        games: {
          some: {
            game: {
              isNsfw: false,
              deletedAt: null,
            },
          },
        },
      },
      select: { id: true, updatedAt: true },
    })
    const urls = companies.map(c =>
      urlEntry(`${siteUrl}/companies/${c.id}`, {
        lastmod: c.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.6',
      })
    )
    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-companies] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

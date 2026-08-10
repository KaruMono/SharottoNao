import prisma from '~/server/utils/prisma'
import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    const tags = await prisma.tag.findMany({
      where: {
        isNsfw: false,
        games: {
          some: {
            game: {
              isNsfw: false,
              deletedAt: null,
            },
          },
        },
      },
      select: { id: true, slug: true, createdAt: true },
    })
    const urls = tags.map(t =>
      urlEntry(`${siteUrl}/tags/${t.slug || t.id}`, {
        lastmod: t.createdAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.6',
      })
    )
    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-tags] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

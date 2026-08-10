import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

    const urls = [
      urlEntry(`${siteUrl}/`, { changefreq: 'daily', priority: '1.0' }),
      urlEntry(`${siteUrl}/games`, { changefreq: 'daily', priority: '0.9' }),
      urlEntry(`${siteUrl}/companies`, { changefreq: 'weekly', priority: '0.8' }),
      urlEntry(`${siteUrl}/tags`, { changefreq: 'weekly', priority: '0.8' }),
      urlEntry(`${siteUrl}/posts`, { changefreq: 'weekly', priority: '0.7' }),
      urlEntry(`${siteUrl}/tools`, { changefreq: 'weekly', priority: '0.7' }),
      urlEntry(`${siteUrl}/calendar`, { changefreq: 'daily', priority: '0.7' }),
      urlEntry(`${siteUrl}/leaderboard`, { changefreq: 'daily', priority: '0.6' }),
      urlEntry(`${siteUrl}/about`, { changefreq: 'monthly', priority: '0.5' }),
    ]
    return sendSitemapXml(event, wrapUrlset(urls))
  } catch (error) {
    console.error('[sitemap-static] Error generating sitemap:', error)
    throw createError({ statusCode: 500, message: 'Failed to generate sitemap' })
  }
})

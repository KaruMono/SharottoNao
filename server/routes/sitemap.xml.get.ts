import prisma from '~/server/utils/prisma'
import { escapeXml, sendSitemapXml, URLS_PER_SITEMAP } from '~/server/utils/sitemap'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')
  const gameCount = await prisma.game.count({
    where: { isNsfw: false, deletedAt: null },
  })
  const gamePages = Math.max(1, Math.ceil(gameCount / URLS_PER_SITEMAP))

  const sitemaps: string[] = []

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-static.xml</loc>
  </sitemap>`)

  for (let i = 1; i <= gamePages; i++) {
    sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-games-${i}.xml</loc>
  </sitemap>`)
  }

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-guides.xml</loc>
  </sitemap>`)

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-posts.xml</loc>
  </sitemap>`)

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-tags.xml</loc>
  </sitemap>`)

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-companies.xml</loc>
  </sitemap>`)

  sitemaps.push(`  <sitemap>
    <loc>${escapeXml(siteUrl)}/sitemap-series.xml</loc>
  </sitemap>`)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('\n')}
</sitemapindex>`

  return sendSitemapXml(event, xml)
})

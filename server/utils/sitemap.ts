import type { H3Event } from 'h3'

export const URLS_PER_SITEMAP = 5000

export function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function urlEntry(loc: string, opts: { lastmod?: string; changefreq?: string; priority?: string } = {}): string {
  let xml = `  <url>\n    <loc>${escapeXml(loc)}</loc>`
  if (opts.lastmod) xml += `\n    <lastmod>${opts.lastmod}</lastmod>`
  if (opts.changefreq) xml += `\n    <changefreq>${opts.changefreq}</changefreq>`
  if (opts.priority) xml += `\n    <priority>${opts.priority}</priority>`
  xml += `\n  </url>`
  return xml
}

export function wrapUrlset(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
}

export function sendSitemapXml(event: H3Event, xml: string) {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return xml
}

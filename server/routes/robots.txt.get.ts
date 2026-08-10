export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

  const robotsTxt = `# Robots.txt for ${siteUrl}
User-agent: *
Allow: /
Allow: /games
Allow: /companies
Allow: /tags
Allow: /posts
Allow: /about

# 禁止爬取需要登录的页面
Disallow: /profile
Disallow: /create
Disallow: /admin
Disallow: /messages
Disallow: /private-messages
Disallow: /login
Disallow: /register
Disallow: /download
Disallow: /tool-download
Disallow: /following
Disallow: /search

# 禁止爬取 API
Disallow: /api/

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml
`

  setHeader(event, 'Content-Type', 'text/plain')
  setHeader(event, 'Cache-Control', 'public, max-age=86400') // 缓存24小时
  
  return robotsTxt
})

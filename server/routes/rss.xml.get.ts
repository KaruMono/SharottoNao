import prisma from '~/server/utils/prisma'
import { getDisplayTitle, getDisplayDescription } from '~/server/utils/game'
import { stripHtml } from '~/server/utils/html'
import { getSiteName } from '~/server/utils/settings'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')
  const query = getQuery(event)
  const type = (query.type as string) || 'games'
  const siteName = await getSiteName()

  let items: string[] = []
  let channelTitle = `${siteName} - Galgame 资源数据库`
  let channelDescription = '最新 Galgame 游戏信息和资源'
  let channelLink = siteUrl

  if (type === 'games') {
    channelTitle = `${siteName} - 最新游戏`
    channelDescription = '最新收录的 Galgame 游戏'
    channelLink = `${siteUrl}/games`

    const games = await prisma.game.findMany({
      where: { isNsfw: false, deletedAt: null },
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        descriptionEn: true,
        descriptionJa: true,
        descriptionZhHans: true,
        descriptionZhHant: true,
        coverImage: true,
        createdAt: true,
        companies: {
          include: {
            company: { select: { name: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    items = games.map(game => {
      const title = getDisplayTitle(game)
      const desc = getDisplayDescription(game)
      const plainDesc = desc ? stripHtml(desc).slice(0, 300) : ''
      const company = game.companies[0]?.company?.name || ''
      const pubDate = game.createdAt.toUTCString()

      return `    <item>
      <title><![CDATA[${title}]]></title>
      <link>${siteUrl}/games/${game.id}</link>
      <guid>${siteUrl}/games/${game.id}</guid>
      <description><![CDATA[${company ? `[${company}] ` : ''}${plainDesc}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${game.coverImage ? `<enclosure url="${game.coverImage}" type="image/webp" />` : ''}
    </item>`
    })
  } else if (type === 'resources') {
    channelTitle = `${siteName} - 最新资源`
    channelDescription = '最新上传的 Galgame 下载资源'

    const resources = await prisma.resource.findMany({
      where: {
        status: 'APPROVED',
        deletedAt: null,
        game: { isNsfw: false, deletedAt: null },
      },
      include: {
        game: {
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
          },
        },
        type: true,
        uploader: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    items = resources.map(r => {
      const gameTitle = getDisplayTitle(r.game)
      const pubDate = r.createdAt.toUTCString()
      return `    <item>
      <title><![CDATA[${gameTitle} - ${r.title}]]></title>
      <link>${siteUrl}/games/${r.game.id}</link>
      <guid>${siteUrl}/download/${r.id}</guid>
      <description><![CDATA[类型: ${r.type?.name || '未知'} | 上传者: ${r.uploader?.username || '匿名'}${r.remark ? ' | ' + r.remark : ''}]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>`
    })
  } else if (type === 'guides') {
    channelTitle = `${siteName} - 最新攻略`
    channelDescription = '最新发布的 Galgame 攻略'

    const guides = await prisma.guide.findMany({
      where: {
        game: { isNsfw: false, deletedAt: null },
      },
      include: {
        game: {
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
          },
        },
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    items = guides.map(g => {
      const gameTitle = getDisplayTitle(g.game)
      const pubDate = g.createdAt.toUTCString()
      return `    <item>
      <title><![CDATA[${gameTitle} - ${g.title}]]></title>
      <link>${siteUrl}/games/${g.game.id}/guides</link>
      <guid>${siteUrl}/games/${g.game.id}/guides#${g.id}</guid>
      <description><![CDATA[作者: ${g.user?.username || '匿名'} | ${stripHtml(g.content).slice(0, 200)}]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>`
    })
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${channelTitle}</title>
    <description>${channelDescription}</description>
    <link>${channelLink}</link>
    <atom:link href="${siteUrl}/rss.xml?type=${type}" rel="self" type="application/rss+xml" />
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=1800') // 缓存 30 分钟
  return rss
})

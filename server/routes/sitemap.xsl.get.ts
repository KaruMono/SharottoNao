function buildXsl(siteName: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" indent="yes" encoding="UTF-8"/>
  <xsl:template match="/">
    <html>
      <head>
        <title>Sitemap - ${siteName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, nofollow"/>
        <style>
          :root {
            --radius: 0.625rem;
            --bg: #fafafa;
            --fg: #18181b;
            --card: #ffffff;
            --card-muted: #f4f4f5;
            --card-hover: #fafafa;
            --border: #e4e4e7;
            --muted: #a1a1aa;
            --primary: #18181b;
            --link: #3b82f6;
            --badge-bg: #f4f4f5;
            --badge-fg: #52525b;
            --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #09090b;
              --fg: #fafafa;
              --card: #18181b;
              --card-muted: #27272a;
              --card-hover: #1f1f23;
              --border: #27272a;
              --muted: #71717a;
              --primary: #fafafa;
              --link: #60a5fa;
              --badge-bg: #27272a;
              --badge-fg: #a1a1aa;
              --shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
            }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            color: var(--fg);
            background: var(--bg);
            line-height: 1.5;
          }
          .header {
            padding: 24px;
            border-bottom: 1px solid var(--border);
            background: var(--card);
            position: sticky;
            top: 0;
            z-index: 10;
          }
          .header-inner {
            max-width: 1080px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .brand {
            font-size: 18px;
            font-weight: 700;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .brand svg {
            width: 20px;
            height: 20px;
            opacity: 0.6;
          }
          .meta {
            color: var(--muted);
            font-size: 13px;
          }
          .container {
            max-width: 1080px;
            margin: 0 auto;
            padding: 24px;
          }
          .info {
            margin-bottom: 16px;
            padding: 12px 16px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            color: var(--muted);
            font-size: 13px;
            line-height: 1.6;
          }
          .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          .table th {
            background: var(--card-muted);
            text-align: left;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            color: var(--muted);
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .table td {
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
          }
          .table tr:last-child td {
            border-bottom: none;
          }
          .table tr:hover td {
            background: var(--card-hover);
          }
          .link {
            color: var(--link);
            text-decoration: none;
            word-break: break-all;
          }
          .link:hover {
            text-decoration: underline;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            background: var(--badge-bg);
            color: var(--badge-fg);
            font-size: 12px;
            font-weight: 500;
          }
          .count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: var(--badge-bg);
            color: var(--badge-fg);
            font-size: 12px;
            font-weight: 600;
          }
          .empty {
            padding: 48px 24px;
            text-align: center;
            color: var(--muted);
          }
          .footer {
            text-align: center;
            padding: 24px;
            color: var(--muted);
            font-size: 12px;
          }
          @media (max-width: 640px) {
            .table th:nth-child(n+3),
            .table td:nth-child(n+3) {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-inner">
            <div class="brand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              ${siteName} Sitemap
            </div>
            <div class="meta">
              <a class="link" href="/">&#x2190; Back to site</a>
            </div>
          </div>
        </div>
        <div class="container">
          <div class="info">
            This is an XML sitemap, meant for consumption by search engines.
            You can find more information about XML sitemaps at
            <a class="link" href="https://www.sitemaps.org/">sitemaps.org</a>.
          </div>
          <div class="card">
            <xsl:choose>
              <xsl:when test="s:sitemapindex">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width:auto">Sitemap</th>
                      <th style="width:140px">Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="s:sitemapindex/s:sitemap">
                      <tr>
                        <td><a class="link" href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                        <td><xsl:value-of select="s:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>
              <xsl:when test="s:urlset">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width:auto">URL</th>
                      <th style="width:140px">Last Modified</th>
                      <th style="width:100px">Changefreq</th>
                      <th style="width:80px">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="s:urlset/s:url">
                      <tr>
                        <td><a class="link" href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                        <td><xsl:value-of select="s:lastmod"/></td>
                        <td><xsl:if test="s:changefreq"><span class="badge"><xsl:value-of select="s:changefreq"/></span></xsl:if></td>
                        <td><xsl:if test="s:priority"><span class="badge"><xsl:value-of select="s:priority"/></span></xsl:if></td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>
              <xsl:otherwise>
                <div class="empty">No sitemap entries found.</div>
              </xsl:otherwise>
            </xsl:choose>
          </div>
        </div>
        <div class="footer">
          Generated by ${siteName}
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`
}

import { getSiteName } from '~/server/utils/settings'

export default defineEventHandler(async (event) => {
  const siteName = await getSiteName()
  setHeader(event, 'Content-Type', 'text/xsl; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  return buildXsl(siteName)
})

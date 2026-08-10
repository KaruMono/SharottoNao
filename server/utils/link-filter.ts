/**
 * 链接过滤工具
 * 用于检测和移除用户生成内容中的不安全链接
 */

// 白名单域名列表
const WHITELISTED_DOMAINS = [
  // 官方域名
  'sharotto.com',
  'www.sharotto.com',
  
  // 游戏相关官方网站
  'vndb.org',
  'www.vndb.org',
  'getchu.com',
  'www.getchu.com',
  'dlsite.com',
  'www.dlsite.com',
  
  // 视频平台
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'bilibili.com',
  'www.bilibili.com',
  'b23.tv',
  
  // 图片托管
  'imgur.com',
  'i.imgur.com',
  
  // 开发者平台
  'github.com',
  'gitlab.com',
]

/**
 * 检查域名是否在白名单中
 */
function isDomainWhitelisted(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase()
  return WHITELISTED_DOMAINS.some(whitelist => {
    return normalizedDomain === whitelist || normalizedDomain.endsWith('.' + whitelist)
  })
}

/**
 * 从 HTML 内容中提取所有链接
 */
function extractLinks(html: string): Array<{ url: string; domain: string }> {
  const links: Array<{ url: string; domain: string }> = []
  
  // 匹配 <a> 标签中的 href
  const aTagRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let match
  
  while ((match = aTagRegex.exec(html)) !== null) {
    const url = match[1]
    try {
      const urlObj = new URL(url)
      links.push({
        url,
        domain: urlObj.hostname,
      })
    } catch {
      // 忽略无效 URL
    }
  }
  
  return links
}

/**
 * 移除 HTML 中的所有链接（保留文本内容）
 */
function removeLinks(html: string): string {
  // 移除 <a> 标签，但保留其文本内容
  return html.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
}

/**
 * 移除 HTML 中不在白名单的链接
 */
function removeNonWhitelistedLinks(html: string): string {
  return html.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, (match, url, text) => {
    try {
      const urlObj = new URL(url)
      if (isDomainWhitelisted(urlObj.hostname)) {
        return match // 保留白名单链接
      }
      return text // 移除非白名单链接，保留文本
    } catch {
      return text // 无效 URL，移除链接
    }
  })
}

/**
 * 检测内容中是否包含链接
 */
export function hasLinks(content: string): boolean {
  const links = extractLinks(content)
  return links.length > 0
}

/**
 * 检测内容中是否包含非白名单链接
 */
export function hasNonWhitelistedLinks(content: string): boolean {
  const links = extractLinks(content)
  return links.some(link => !isDomainWhitelisted(link.domain))
}

/**
 * 过滤内容中的链接
 * @param content HTML 内容
 * @param mode 'remove-all' | 'whitelist' - 移除所有链接或仅移除非白名单链接
 */
export function filterLinks(content: string, mode: 'remove-all' | 'whitelist' = 'whitelist'): string {
  if (mode === 'remove-all') {
    return removeLinks(content)
  }
  return removeNonWhitelistedLinks(content)
}

/**
 * 获取内容中的非白名单链接列表
 */
export function getNonWhitelistedLinks(content: string): string[] {
  const links = extractLinks(content)
  return links
    .filter(link => !isDomainWhitelisted(link.domain))
    .map(link => link.url)
}

/**
 * 获取白名单域名列表（用于管理界面）
 */
export function getWhitelistedDomains(): string[] {
  return [...WHITELISTED_DOMAINS]
}

/**
 * 表情解析工具
 * 将 [emoji:包名:表情名] 格式的文本转换为图片
 */

interface Emoji {
  id: number
  name: string
  url: string
}

interface EmojiPack {
  id: number
  name: string
  emojis: Emoji[]
}

// 缓存表情数据（packName:emojiName -> url）
// 仅在客户端缓存，避免 SSR 请求间状态污染
let emojiCache: Map<string, string> | null = null
let emojiCachePromise: Promise<Map<string, string>> | null = null

/**
 * 转义 HTML 属性值中的特殊字符，防止属性注入 XSS
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 获取表情映射表（packName:emojiName -> url）
 */
async function getEmojiMap(): Promise<Map<string, string>> {
  // SSR 环境下不缓存，避免请求间状态污染
  if (import.meta.server) {
    try {
      const packs = await $fetch<EmojiPack[]>('/api/emoji-packs')
      const map = new Map<string, string>()
      for (const pack of packs) {
        for (const emoji of pack.emojis) {
          map.set(`${pack.name}:${emoji.name}`, emoji.url)
        }
      }
      return map
    } catch {
      return new Map()
    }
  }

  if (emojiCache) return emojiCache

  if (emojiCachePromise) return emojiCachePromise

  emojiCachePromise = (async () => {
    try {
      const packs = await $fetch<EmojiPack[]>('/api/emoji-packs')
      const map = new Map<string, string>()
      
      for (const pack of packs) {
        for (const emoji of pack.emojis) {
          // 使用 包名:表情名 作为key
          const key = `${pack.name}:${emoji.name}`
          map.set(key, emoji.url)
        }
      }
      
      emojiCache = map
      return map
    } catch (error) {
      console.error('获取表情包失败:', error)
      return new Map()
    }
  })()

  return emojiCachePromise
}

/**
 * 清除表情缓存（当表情包更新时调用）
 */
export function clearEmojiCache() {
  emojiCache = null
  emojiCachePromise = null
}

/**
 * 解析内容中的表情标记，替换为图片标签
 * 支持格式：[emoji:包名:表情名]
 * @param content HTML内容
 * @returns 替换后的HTML内容
 */
export async function parseEmojis(content: string): Promise<string> {
  if (!content) return content

  const emojiMap = await getEmojiMap()
  
  // 匹配 [emoji:包名:表情名] 格式
  return content.replace(/\[emoji:([^:\]]+):([^\]]+)\]/g, (match, packName, emojiName) => {
    const key = `${packName}:${emojiName}`
    const url = emojiMap.get(key)
    if (url) {
      return `<img src="${escapeAttr(url)}" alt="${escapeAttr(emojiName)}" class="inline-emoji" style="width:20px;height:20px;display:inline;vertical-align:middle;margin:0;padding:0;" />`
    }
    return match // 如果找不到表情，保留原文本
  })
}

/**
 * Vue composable 用于解析表情
 */
export function useEmoji() {
  return {
    parseEmojis,
    clearEmojiCache,
  }
}

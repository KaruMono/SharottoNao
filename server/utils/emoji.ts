import prisma from './prisma'

// 缓存表情映射
let emojiCache: Map<string, string> | null = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

/**
 * 获取表情映射表（packName:emojiName -> url）
 */
async function getEmojiMap(): Promise<Map<string, string>> {
  const now = Date.now()
  
  if (emojiCache && (now - cacheTime) < CACHE_TTL) {
    return emojiCache
  }

  const emojis = await prisma.emoji.findMany({
    include: {
      pack: {
        select: { isActive: true, name: true },
      },
    },
  })

  const map = new Map<string, string>()
  for (const emoji of emojis) {
    if (emoji.pack.isActive) {
      // 使用 包名:表情名 作为key
      const key = `${emoji.pack.name}:${emoji.name}`
      map.set(key, emoji.url)
    }
  }

  emojiCache = map
  cacheTime = now
  return map
}

/**
 * 清除表情缓存
 */
export function clearEmojiCache() {
  emojiCache = null
  cacheTime = 0
}

/**
 * 解析内容中的表情标记，替换为图片标签
 * 支持格式：[emoji:包名:表情名]
 * @param content HTML内容
 * @returns 替换后的HTML内容
 */
export async function parseEmojis(content: string | null | undefined): Promise<string> {
  if (!content) return ''

  const emojiMap = await getEmojiMap()
  
  // 匹配 [emoji:包名:表情名] 格式
  return content.replace(/\[emoji:([^:\]]+):([^\]]+)\]/g, (match, packName, emojiName) => {
    const key = `${packName}:${emojiName}`
    const url = emojiMap.get(key)
    if (url) {
      return `<img src="${url}" alt="${emojiName}" class="inline-emoji" style="width:20px;height:20px;display:inline;vertical-align:middle;margin:0;padding:0;" />`
    }
    return match // 如果找不到表情，保留原文本
  })
}

/**
 * 批量解析评论内容中的表情
 */
export async function parseCommentsEmojis<T extends { content: string; replies?: T[] }>(comments: T[]): Promise<T[]> {
  const result: T[] = []
  
  for (const comment of comments) {
    const parsed = {
      ...comment,
      content: await parseEmojis(comment.content),
    }
    
    if (comment.replies?.length) {
      parsed.replies = await parseCommentsEmojis(comment.replies)
    }
    
    result.push(parsed)
  }
  
  return result
}

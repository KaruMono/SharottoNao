import { z } from 'zod'

// VNDB API 响应类型
interface VNDBTitle {
  title: string
  lang: string
  latin?: string
  official: boolean
  main: boolean
}

interface VNDBImage {
  id: string
  url: string
  dims: [number, number]
  sexual: number
  violence: number
}

interface VNDBTag {
  id: string
  name: string
  rating: number
  spoiler: number
}

interface VNDBStaff {
  id: string
  name: string
  original: string | null
  role: string
  note: string | null
}

interface VNDBDeveloper {
  id: string
  name: string
  original: string | null
}

interface VNDBResult {
  id: string
  title: string
  titles: VNDBTitle[]
  aliases: string[]
  released: string | null
  description: string | null
  image?: VNDBImage
  tags: VNDBTag[]
  devstatus: number
  length: number | null
  length_minutes: number | null
  length_votes: number
  staff: VNDBStaff[]
  developers: VNDBDeveloper[]
}

interface VNDBResponse {
  more: boolean
  results: VNDBResult[]
}

const idSchema = z.string().regex(/^v\d+$/, 'VNDB ID 格式错误，应为 v 开头加数字')

// 清理 VNDB 描述文本中的标记
function cleanDescription(text: string | null): string | null {
  if (!text) return null
  
  let cleaned = text
  // 移除 [url=...] 标记
  cleaned = cleaned.replace(/\[url=[^\]]*\]/g, '')
  cleaned = cleaned.replace(/\[\/url\]/g, '')
  // 移除其他标记
  cleaned = cleaned.replace(/\[spoiler\]/g, '')
  cleaned = cleaned.replace(/\[\/spoiler\]/g, '')
  cleaned = cleaned.replace(/\[b\]/g, '')
  cleaned = cleaned.replace(/\[\/b\]/g, '')
  cleaned = cleaned.replace(/\[i\]/g, '')
  cleaned = cleaned.replace(/\[\/i\]/g, '')
  
  return cleaned
}

export default defineEventHandler(async (event) => {
  const vndbId = getRouterParam(event, 'id')
  
  if (!vndbId) {
    throw createError({
      statusCode: 400,
      message: 'VNDB ID 不能为空',
    })
  }

  // 验证 ID 格式
  const normalizedId = vndbId.toLowerCase()
  try {
    idSchema.parse(normalizedId)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'VNDB ID 格式错误，应为 v 开头加数字，如 v27448',
    })
  }

  try {
    // 调用 VNDB API
    const response = await fetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: ['id', '=', normalizedId],
        fields: 'title, titles.title, titles.lang, titles.latin, titles.official, titles.main, aliases, released, description, image.url, image.dims, image.sexual, image.violence, tags{id,name,rating,spoiler}, devstatus, length, length_minutes, staff{id,name,original,role,note}, developers{id,name,original}',
      }),
    })

    if (!response.ok) {
      throw createError({
        statusCode: 502,
        message: 'VNDB API 请求失败',
      })
    }

    const data: VNDBResponse = await response.json()

    if (!data.results.length) {
      throw createError({
        statusCode: 404,
        message: '未找到对应的 VNDB 条目',
      })
    }

    const vn = data.results[0]

    // 提取各语言标题
    const titleEn = vn.titles.find(t => t.lang === 'en')?.title || null
    const titleJa = vn.titles.find(t => t.lang === 'ja')?.title || null
    const titleZhHans = vn.titles.find(t => t.lang === 'zh-Hans')?.title || null
    const titleZhHant = vn.titles.find(t => t.lang === 'zh-Hant')?.title || null
    
    // 构建别名列表（排除已作为标题的）
    const usedTitles = new Set([titleEn, titleJa, titleZhHans, titleZhHant, vn.title].filter(Boolean))
    const aliases: string[] = []
    
    // 添加主标题（如果不是已有的语言标题）
    if (!usedTitles.has(vn.title)) {
      aliases.push(vn.title)
      usedTitles.add(vn.title)
    }
    
    // 添加其他标题和拉丁转写
    for (const t of vn.titles) {
      if (!usedTitles.has(t.title)) {
        aliases.push(t.title)
        usedTitles.add(t.title)
      }
      if (t.latin && !usedTitles.has(t.latin)) {
        aliases.push(t.latin)
        usedTitles.add(t.latin)
      }
    }
    
    // 添加 VNDB 别名
    for (const alias of vn.aliases) {
      if (!usedTitles.has(alias)) {
        aliases.push(alias)
        usedTitles.add(alias)
      }
    }

    // 处理封面图片
    let coverImage: string | null = null
    if (vn.image) {
      coverImage = vn.image.url
    }

    // 清理描述文本（VNDB 的描述通常是英文/日文混合，放到英文字段）
    const description = cleanDescription(vn.description)

    // NSFW 判断：封面图 sexual/violence + 标签
    const nsfwByImage = vn.image ? (vn.image.sexual > 1 || vn.image.violence > 1) : false
    // VNDB 标签中的 Sexual Content (g235) 及相关 18+ 标签
    const nsfwTagIds = new Set(['g235', 'g542', 'g254']) // Sexual Content, Only Sexual Content, Nukige
    const nsfwByTags = (vn.tags || []).some(t => nsfwTagIds.has(t.id) && t.rating >= 1.5)

    // 映射 VNDB staff 角色到内部角色
    const vndbRoleMap: Record<string, string> = {
      director: 'DIRECTOR',
      scenario: 'WRITER',
      composer: 'COMPOSER',
      music: 'COMPOSER',
      artist: 'ARTIST',
      chardesign: 'ARTIST',
      vocals: 'VOICE_ACTOR',
    }
    const staff = (vn.staff || [])
      .filter(s => !!vndbRoleMap[s.role])
      .map(s => ({
        name: s.original || s.name,
        nameOriginal: s.original ? s.name : null,
        role: vndbRoleMap[s.role],
        characterName: s.role === 'vocals' ? (s.note || null) : null,
      }))

    return {
      vndbId: normalizedId,
      // 多语言标题
      titleEn,
      titleJa,
      titleZhHans,
      titleZhHant,
      // 别名
      aliases,
      // 简介（放到英文字段，因为 VNDB 主要是英文描述）
      descriptionEn: description,
      // 其他信息
      released: vn.released,
      coverImage,
      isNsfw: nsfwByImage || nsfwByTags,
      // 游戏时长（分钟）
      lengthMinutes: vn.length_minutes,
      // 制作人员
      staff,
      // 开发商（来自 VNDB）
      developers: (vn.developers || []).map(d => ({
        name: d.name,
        nameOriginal: d.original || null,
      })),
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error('VNDB API error:', error)
    throw createError({
      statusCode: 502,
      message: 'VNDB API 请求失败，请稍后重试',
    })
  }
})

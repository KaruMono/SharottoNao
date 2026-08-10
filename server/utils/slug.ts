import pinyinModule from 'pinyin'

const pinyin = (pinyinModule as any).default || pinyinModule

/**
 * 将文本转换为 slug
 * - 英文直接转小写
 * - 中文转拼音，用连字符连接
 * - 特殊字符移除
 */
export function generateSlug(text: string): string {
  // 检查是否包含中文
  const hasChinese = /[\u4e00-\u9fa5]/.test(text)
  
  if (hasChinese) {
    // 中文转拼音
    const pinyinResult = pinyin(text, {
      style: pinyin.STYLE_NORMAL, // 不带声调
      heteronym: false,
    })
    
    // 将拼音数组扁平化并用连字符连接
    const slug = pinyinResult
      .flat()
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') // 移除非字母数字和连字符
      .replace(/-+/g, '-') // 合并多个连字符
      .replace(/^-|-$/g, '') // 移除首尾连字符
    
    return slug
  } else {
    // 英文/其他语言
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '-') // 空格转连字符
      .replace(/-+/g, '-') // 合并多个连字符
      .replace(/^-|-$/g, '') // 移除首尾连字符
  }
}

/**
 * 生成唯一的 slug（检查重复并添加后缀）
 */
export async function generateUniqueSlug(
  text: string,
  checkExists: (slug: string) => Promise<boolean>,
  excludeId?: number
): Promise<string> {
  let baseSlug = generateSlug(text)
  
  // 如果 slug 为空，使用默认值
  if (!baseSlug) {
    baseSlug = 'tag'
  }
  
  let slug = baseSlug
  let counter = 2
  
  // 检查是否存在，如果存在则添加后缀
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}

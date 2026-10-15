import prisma from './prisma'

/**
 * 标签名归一化。
 *
 * 用于「玩家自由输入标签名」场景：把同一个标签的各种写法收敛到一个形态，
 * 避免词表漂移出「ＮＴＲ / NTR / ntr 」这类近义标签。
 *
 * 注意：这里刻意 **不做大小写折叠**，只归一化空白与全角字符。
 * 大小写仅在「比较」时忽略（见 findTagByName），保留用户输入的原始大小写，
 * 否则 NTR 会被存成 ntr。
 */
export function normalizeTagName(raw: string): string {
  if (!raw) return ''

  return raw
    // 全角字符转半角（！-～ → !-~），全角空格单独处理
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    // 各类空白折叠为单个半角空格
    .replace(/\s+/g, ' ')
    .trim()
    // 去掉首尾的标点/分隔符（中英文逗号、句号、顿号、斜杠等）
    .replace(/^[,，、。.\/|·\-_]+|[,，、。.\/|·\-_]+$/g, '')
    .trim()
}

/** 归一化 + 去重（忽略大小写），保留首次出现的写法与顺序 */
export function normalizeTagNames(raws: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of raws) {
    const name = normalizeTagName(raw)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }

  return result
}

/**
 * 按归一化后的名称精确查找已有标签（忽略大小写）。
 * 命中说明玩家敲的其实是既有标签，应直接归位到 tagIds 而非新建。
 */
export async function findTagByName(name: string) {
  const normalized = normalizeTagName(name)
  if (!normalized) return null
  const normalizedName = normalized.toLowerCase()

  return prisma.tag.findFirst({
    where: {
      archivedAt: null,
      isSystem: false,
      OR: [
        { name: { equals: normalized, mode: 'insensitive' } },
        { aliases: { some: { normalizedName } } },
      ],
    },
    select: { id: true, name: true, color: true, isNsfw: true },
  })
}

/**
 * 查找与输入相近的已有标签，用于前端「是不是想选这个？」提示。
 * 归一化后做包含匹配（双向：输入包含标签名、标签名包含输入）。
 */
export async function findSimilarTags(name: string, limit = 5) {
  const normalized = normalizeTagName(name)
  if (!normalized) return []

  return prisma.tag.findMany({
    where: {
      archivedAt: null,
      isSystem: false,
      OR: [
        { name: { contains: normalized, mode: 'insensitive' } },
        { aliases: { some: { name: { contains: normalized, mode: 'insensitive' } } } },
      ],
    },
    select: { id: true, name: true, color: true, isNsfw: true },
    take: limit,
  })
}

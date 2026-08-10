/**
 * 游戏条目编辑 diff 工具
 * 比较编辑前后的差异，生成结构化的变更记录
 */

interface GameDiffChange {
  field: string
  label: string
  old?: unknown
  new?: unknown
}

interface GameDiffResult {
  changes: GameDiffChange[]
  summary: string
}

const FIELD_LABELS: Record<string, string> = {
  titleEn: '英文标题',
  titleJa: '日文标题',
  titleZhHans: '简体中文标题',
  titleZhHant: '繁体中文标题',
  aliases: '别名',
  descriptionEn: '英文简介',
  descriptionJa: '日文简介',
  descriptionZhHans: '简体中文简介',
  descriptionZhHant: '繁体中文简介',
  coverImage: '封面图片',
  releaseDate: '发售日期',
  isNsfw: 'NSFW 标记',
  vndbId: 'VNDB ID',
  bangumiId: 'Bangumi ID',
  purchaseLinks: '相关链接',
  lengthMinutes: '游戏时长',
  seriesId: '游戏系列',
  tags: '标签',
  companies: '关联会社',
  staff: 'STAFF',
  screenshots: '游戏截图',
}

const CATEGORY_LABELS: Record<string, string> = {
  title: '游戏标题',
  description: '游戏简介',
  basic: '基本信息',
  cover: '封面图片',
  tags: '标签',
  screenshots: '游戏截图',
  staff: 'STAFF',
  companies: '关联会社',
  links: '相关链接',
  settings: '设置',
  series: '游戏系列',
}

function fieldToCategory(field: string): string {
  if (field.startsWith('title') || field === 'aliases') return 'title'
  if (field.startsWith('description')) return 'description'
  if (field === 'coverImage') return 'cover'
  if (field === 'tags') return 'tags'
  if (field === 'screenshots') return 'screenshots'
  if (field === 'staff') return 'staff'
  if (field === 'companies') return 'companies'
  if (field === 'purchaseLinks') return 'links'
  if (field === 'seriesId') return 'series'
  if (['isNsfw', 'lengthMinutes'].includes(field)) return 'settings'
  return 'basic'
}

function normalize(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 比较游戏基本字段的变更
 */
export function diffGameFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
): GameDiffChange[] {
  const changes: GameDiffChange[] = []

  const scalarFields = [
    'titleEn', 'titleJa', 'titleZhHans', 'titleZhHant',
    'descriptionEn', 'descriptionJa', 'descriptionZhHans', 'descriptionZhHant',
    'coverImage', 'isNsfw', 'vndbId', 'bangumiId', 'lengthMinutes', 'seriesId',
  ]

  for (const field of scalarFields) {
    if (!(field in newData)) continue
    const oldVal = normalize(oldData[field])
    const newVal = normalize(newData[field])
    if (oldVal !== newVal) {
      changes.push({
        field,
        label: FIELD_LABELS[field] || field,
        old: oldData[field] ?? null,
        new: newData[field] ?? null,
      })
    }
  }

  if ('releaseDate' in newData) {
    const oldDate = oldData.releaseDate
      ? (oldData.releaseDate instanceof Date ? oldData.releaseDate.toISOString().split('T')[0] : String(oldData.releaseDate).split('T')[0])
      : null
    const newDate = newData.releaseDate
      ? String(newData.releaseDate).split('T')[0]
      : null
    if (oldDate !== newDate) {
      changes.push({ field: 'releaseDate', label: FIELD_LABELS.releaseDate, old: oldDate, new: newDate })
    }
  }

  if ('aliases' in newData) {
    const oldArr = (oldData.aliases as string[]) || []
    const newArr = (newData.aliases as string[]) || []
    if (!arraysEqual(oldArr, newArr)) {
      changes.push({ field: 'aliases', label: FIELD_LABELS.aliases, old: oldArr, new: newArr })
    }
  }

  if ('purchaseLinks' in newData) {
    const oldLinks = (oldData.purchaseLinks as unknown[]) || []
    const newLinks = (newData.purchaseLinks as unknown[]) || []
    if (!arraysEqual(oldLinks, newLinks)) {
      changes.push({ field: 'purchaseLinks', label: FIELD_LABELS.purchaseLinks, old: oldLinks, new: newLinks })
    }
  }

  return changes
}

/**
 * 比较关联数据（标签、截图、STAFF、会社）
 */
export function diffGameRelations(
  oldData: {
    tags?: { tagId: number }[]
    screenshots?: { url: string }[]
    staff?: { staffId: number; role: string; characterName?: string | null }[]
    companies?: { companyId: number; role: string }[]
  },
  newData: {
    tagIds?: number[]
    screenshots?: string[]
    staff?: { staffId?: number; name?: string; role: string; characterName?: string }[]
    companies?: { companyId: number; role: string }[]
  },
): GameDiffChange[] {
  const changes: GameDiffChange[] = []

  if (newData.tagIds !== undefined) {
    const oldIds = (oldData.tags || []).map(t => t.tagId).sort((a, b) => a - b)
    const newIds = [...newData.tagIds].sort((a, b) => a - b)
    if (!arraysEqual(oldIds, newIds)) {
      const added = newIds.filter(id => !oldIds.includes(id))
      const removed = oldIds.filter(id => !newIds.includes(id))
      changes.push({
        field: 'tags',
        label: FIELD_LABELS.tags,
        old: { ids: oldIds, count: oldIds.length },
        new: { ids: newIds, count: newIds.length, added, removed },
      })
    }
  }

  if (newData.screenshots !== undefined) {
    const oldUrls = (oldData.screenshots || []).map(s => s.url)
    const newUrls = newData.screenshots
    if (!arraysEqual(oldUrls, newUrls)) {
      changes.push({
        field: 'screenshots',
        label: FIELD_LABELS.screenshots,
        old: { count: oldUrls.length },
        new: { count: newUrls.length },
      })
    }
  }

  if (newData.staff !== undefined) {
    const oldStaff = (oldData.staff || []).map(s => `${s.staffId}:${s.role}`)
    const newStaff = newData.staff.map(s => `${s.staffId || s.name}:${s.role}`)
    if (!arraysEqual(oldStaff.sort(), newStaff.sort())) {
      changes.push({
        field: 'staff',
        label: FIELD_LABELS.staff,
        old: { count: oldData.staff?.length || 0 },
        new: { count: newData.staff.length },
      })
    }
  }

  if (newData.companies !== undefined) {
    const oldCompanies = (oldData.companies || []).map(c => `${c.companyId}:${c.role}`)
    const newCompanies = newData.companies.map(c => `${c.companyId}:${c.role}`)
    if (!arraysEqual(oldCompanies.sort(), newCompanies.sort())) {
      changes.push({
        field: 'companies',
        label: FIELD_LABELS.companies,
        old: { count: oldData.companies?.length || 0 },
        new: { count: newData.companies.length },
      })
    }
  }

  return changes
}

/**
 * 生成人类可读的变更摘要
 */
export function buildChangeSummary(changes: GameDiffChange[], prefix: string = '编辑游戏条目'): string {
  if (changes.length === 0) return prefix

  const categories = new Set(changes.map(c => fieldToCategory(c.field)))
  const categoryLabels = [...categories].map(c => CATEGORY_LABELS[c] || c)

  let summary = `${prefix}（${categoryLabels.join('，')}）`

  const details: string[] = []
  for (const change of changes) {
    const cat = fieldToCategory(change.field)
    if (cat === 'series' && change.new !== null && change.new !== undefined) {
      details.push(`系列 → #${change.new}`)
    } else if (change.field === 'isNsfw') {
      details.push(`NSFW: ${change.old ? '是' : '否'} → ${change.new ? '是' : '否'}`)
    } else if (change.field === 'tags' && typeof change.new === 'object' && change.new !== null) {
      const info = change.new as { added?: number[]; removed?: number[] }
      if (info.added?.length) details.push(`标签 +${info.added.length}`)
      if (info.removed?.length) details.push(`标签 -${info.removed.length}`)
    } else if (change.field === 'screenshots' && typeof change.new === 'object' && change.new !== null) {
      const oldCount = (change.old as { count: number })?.count || 0
      const newCount = (change.new as { count: number })?.count || 0
      details.push(`截图 ${oldCount} → ${newCount}`)
    }
  }

  if (details.length > 0) {
    summary += `；${details.join('，')}`
  }

  return summary
}

/**
 * 完整的游戏编辑 diff：字段 + 关联，返回变更列表和摘要
 */
export function diffGame(
  oldGame: Record<string, unknown>,
  newData: Record<string, unknown>,
  prefix: string = '编辑游戏条目',
): GameDiffResult {
  const fieldChanges = diffGameFields(oldGame, newData)
  const relationChanges = diffGameRelations(
    oldGame as any,
    newData as any,
  )
  const changes = [...fieldChanges, ...relationChanges]
  const summary = buildChangeSummary(changes, prefix)
  return { changes, summary }
}

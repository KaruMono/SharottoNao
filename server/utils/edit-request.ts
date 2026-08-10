import type { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { normalizeTagName } from '~/server/utils/tag-normalize'
import { pickTagColor } from '~/server/utils/tag-color'
import { generateUniqueSlug } from '~/server/utils/slug'

/**
 * 条目修改请求（gameEditRequest）的变更计算与应用。
 *
 * changes 结构统一为 { [field]: { old, new } }：
 * - 标量字段（标题/简介/封面/vndbId/bangumiId/isNsfw/seriesId/lengthMinutes）直接存原值；
 * - releaseDate 统一归一化为 'YYYY-MM-DD' 字符串再比较与存储，避免 Date 对象与字符串
 *   永远不相等导致的“假变更”（旧值新值显示一模一样）；
 * - aliases / purchaseLinks 存数组；
 * - tagIds 存 number[]；
 * - newTagNames 存 string[]（玩家自由输入、词表里还不存在的标签名）。
 *   纯新增，没有 old 可比，固定记为 { old: [], new: [...] }。
 *   刻意不并进 tagIds：混在一起后 diff 渲染和应用逻辑都要判元素类型，易出错。
 *   这些名称在审核通过时才会被创建成真正的 Tag（见 admin/edit-requests review），
 *   applyGameEditChanges 不处理该字段。
 * - companies 存 [{ companyId, role, name }]（name 仅用于展示，应用时用 companyId+role）；
 * - staff 存 [{ name, nameOriginal, role }]。
 */

export interface EditChange {
  old: unknown
  new: unknown
}
export type EditChanges = Record<string, EditChange>

/** 归一化日期为 YYYY-MM-DD（接受 Date 或字符串），无值返回 null */
export function normalizeDateOnly(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    return val.toISOString().split('T')[0]
  }
  const s = String(val)
  return s.split('T')[0].split(' ')[0] || null
}

/** 标量归一化：null/undefined/'' 统一视为空串，便于比较 */
function normScalar(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

interface GameWithRelations {
  [key: string]: unknown
  aliases?: string[] | null
  purchaseLinks?: unknown
  releaseDate?: Date | string | null
  tags?: { tagId: number }[]
  companies?: { companyId: number; role: string; company?: { name?: string } | null }[]
  staff?: { staff: { name: string; nameOriginal: string | null }; role: string }[]
}

interface EditInput {
  [key: string]: unknown
  aliases?: string[]
  purchaseLinks?: unknown[]
  releaseDate?: string
  tagIds?: number[]
  newTagNames?: string[]
  companies?: { companyId: number; role: string; name?: string }[]
  staff?: { name: string; nameOriginal?: string | null; role: string }[]
}

const SCALAR_FIELDS = [
  'titleEn', 'titleJa', 'titleZhHans', 'titleZhHant',
  'descriptionEn', 'descriptionJa', 'descriptionZhHans', 'descriptionZhHant',
  'coverImage', 'isNsfw', 'vndbId', 'bangumiId', 'seriesId', 'lengthMinutes',
] as const

/**
 * 比较现有游戏与提交数据，生成完整的变更记录。
 * 只比较“本次提交里实际存在（!== undefined）”的字段。
 */
export function buildGameEditChanges(game: GameWithRelations, data: EditInput): EditChanges {
  const changes: EditChanges = {}

  for (const field of SCALAR_FIELDS) {
    if (data[field] === undefined) continue
    if (normScalar(game[field]) !== normScalar(data[field])) {
      changes[field] = { old: game[field] ?? null, new: (data[field] as unknown) ?? null }
    }
  }

  // 发售日期：统一按 YYYY-MM-DD 比较
  if (data.releaseDate !== undefined) {
    const oldDate = normalizeDateOnly(game.releaseDate)
    const newDate = normalizeDateOnly(data.releaseDate)
    if (oldDate !== newDate) {
      changes.releaseDate = { old: oldDate, new: newDate }
    }
  }

  // 别名
  if (data.aliases !== undefined) {
    const oldArr = game.aliases || []
    if (JSON.stringify(oldArr) !== JSON.stringify(data.aliases)) {
      changes.aliases = { old: oldArr, new: data.aliases }
    }
  }

  // 购买链接
  if (data.purchaseLinks !== undefined) {
    const oldLinks = (game.purchaseLinks as unknown[]) || []
    if (JSON.stringify(oldLinks) !== JSON.stringify(data.purchaseLinks)) {
      changes.purchaseLinks = { old: oldLinks, new: data.purchaseLinks }
    }
  }

  // 标签
  if (data.tagIds !== undefined) {
    const oldTagIds = (game.tags || []).map(t => t.tagId).sort((a, b) => a - b)
    const newTagIds = [...data.tagIds].sort((a, b) => a - b)
    if (JSON.stringify(oldTagIds) !== JSON.stringify(newTagIds)) {
      changes.tagIds = { old: oldTagIds, new: newTagIds }
    }
  }

  // 待创建的新标签名（词表里没有的），纯新增
  if (data.newTagNames !== undefined && data.newTagNames.length > 0) {
    changes.newTagNames = { old: [], new: data.newTagNames }
  }

  // 关联会社（含角色）；name 仅用于展示
  if (data.companies !== undefined) {
    const oldCompanies = (game.companies || []).map(c => ({
      companyId: c.companyId,
      role: c.role,
      name: c.company?.name ?? `#${c.companyId}`,
    }))
    const newCompanies = data.companies.map(c => ({
      companyId: c.companyId,
      role: c.role,
      name: c.name ?? `#${c.companyId}`,
    }))
    const key = (arr: { companyId: number; role: string }[]) =>
      JSON.stringify([...arr].sort((a, b) => a.companyId - b.companyId || a.role.localeCompare(b.role)).map(c => `${c.companyId}:${c.role}`))
    if (key(oldCompanies) !== key(newCompanies)) {
      changes.companies = { old: oldCompanies, new: newCompanies }
    }
  }

  // STAFF
  if (data.staff !== undefined) {
    const oldStaff = (game.staff || []).map(s => ({
      name: s.staff.name,
      nameOriginal: s.staff.nameOriginal,
      role: s.role,
    }))
    const newStaff = data.staff.map(s => ({
      name: s.name,
      nameOriginal: s.nameOriginal || null,
      role: s.role,
    }))
    if (JSON.stringify(oldStaff) !== JSON.stringify(newStaff)) {
      changes.staff = { old: oldStaff, new: newStaff }
    }
  }

  return changes
}

/**
 * 将一条修改请求的 changes 应用到游戏条目。
 * 在传入的事务客户端上执行；正确处理各字段类型，避免把非标量字段
 * （releaseDate/tagIds/companies/staff）当作普通列直接写入。
 */
export async function applyGameEditChanges(
  tx: Prisma.TransactionClient,
  gameId: number,
  changes: EditChanges,
): Promise<void> {
  const updateData: Record<string, unknown> = {}

  for (const field of SCALAR_FIELDS) {
    if (!(field in changes)) continue
    const val = changes[field].new
    // 空字符串归一化为 null（数据库多为可空列）
    updateData[field] = val === '' ? null : val ?? null
  }

  if ('releaseDate' in changes) {
    const v = changes.releaseDate.new
    updateData.releaseDate = v ? new Date(v as string) : null
  }
  if ('aliases' in changes) {
    updateData.aliases = (changes.aliases.new as string[]) ?? []
  }
  if ('purchaseLinks' in changes) {
    updateData.purchaseLinks = (changes.purchaseLinks.new as Prisma.InputJsonValue) ?? []
  }

  if (Object.keys(updateData).length > 0) {
    await tx.game.update({ where: { id: gameId }, data: updateData })
  }

  // 标签
  if ('tagIds' in changes) {
    const newTagIds = (changes.tagIds.new as number[]) || []
    await tx.gameTag.deleteMany({ where: { gameId } })
    if (newTagIds.length > 0) {
      await tx.gameTag.createMany({ data: newTagIds.map(tagId => ({ gameId, tagId })) })
    }
  }

  // 关联会社
  if ('companies' in changes) {
    const newCompanies = (changes.companies.new as { companyId: number; role: string }[]) || []
    await tx.gameCompany.deleteMany({ where: { gameId } })
    if (newCompanies.length > 0) {
      await tx.gameCompany.createMany({
        data: newCompanies.map(c => ({ gameId, companyId: c.companyId, role: c.role as any })),
      })
    }
  }

  // newTagNames 在 applyGameEditChanges 里不处理——它们在审核通过时才被创建
  // （见 resolveNewTagNames）。此处跳过即可。

  // STAFF
  if ('staff' in changes) {
    const newStaff = (changes.staff.new as { name: string; nameOriginal?: string | null; role: string }[]) || []
    await tx.gameStaff.deleteMany({ where: { gameId } })
    for (const s of newStaff) {
      let staff = await tx.staff.findFirst({ where: { name: s.name } })
      if (!staff) {
        staff = await tx.staff.create({ data: { name: s.name, nameOriginal: s.nameOriginal || null } })
      }
      await tx.gameStaff.create({ data: { gameId, staffId: staff.id, role: s.role as any } })
    }
  }
}

/**
 * 在审核通过时，将 changes 里的 newTagNames 解析为真实 Tag.id。
 *
 * 流程（在事务内调用）：
 * 1. 逐个归一化后按 name insensitive 精确查找；
 * 2. 已存在 → 直接用其 id；
 * 3. 不存在 → 创建（isNsfw / color 来自 newTags overrides，缺省值为 false / 哈希色）；
 * 4. 将全部解析出的 id 并入 changes.tagIds.new，删除 changes.newTagNames；
 * 5. 返回"最终 tagIds"（含原有 + 新增）。
 *
 * @param tx      Prisma 事务客户端
 * @param changes 来自 GameEditRequest.changes 的变更对象，会被就地修改
 * @param overrides 管理员在审核界面的改动
 */
export async function resolveNewTagNames(
  tx: Prisma.TransactionClient,
  changes: Record<string, { old: any; new: any }>,
  overrides?: {
    tagIds?: number[]
    newTags?: Array<{
      name: string
      isNsfw?: boolean
      color?: string
    }>
  },
): Promise<number[]> {
  // 管理员覆盖 tagIds 时以管理员值为准
  let baseTagIds: number[] = overrides?.tagIds !== undefined
    ? overrides.tagIds
    : ((changes.tagIds?.new as number[]) ?? [])

  // 要创建的新标签：优先用管理员 override，否则取原始 newTagNames
  const pendingItems: Array<{ name: string; isNsfw?: boolean; color?: string }> =
    overrides?.newTags
      ? overrides.newTags
      : ((changes.newTagNames?.new as string[]) ?? []).map(n => ({ name: n }))

  const newIds: number[] = []
  for (const item of pendingItems) {
    const normalizedName = normalizeTagName(item.name)
    if (!normalizedName) continue

    let tag = await tx.tag.findFirst({
      where: { name: { equals: normalizedName, mode: 'insensitive' } },
    })

    if (!tag) {
      const slug = await generateUniqueSlug(normalizedName, async (s) => {
        const exists = await tx.tag.findFirst({ where: { slug: s } })
        return !!exists
      })
      tag = await tx.tag.create({
        data: {
          name: normalizedName,
          slug,
          isNsfw: item.isNsfw ?? false,
          color: item.color ?? pickTagColor(normalizedName),
        },
      })
    }

    newIds.push(tag.id)
  }

  const finalTagIds = [...new Set([...baseTagIds, ...newIds])]

  // 写回 changes，使后续 applyGameEditChanges 能正确应用
  if (finalTagIds.length > 0 || 'tagIds' in changes) {
    changes.tagIds = {
      old: changes.tagIds?.old ?? [],
      new: finalTagIds,
    }
  }

  // newTagNames 已消化，删除避免快照里残留
  delete changes.newTagNames

  return finalTagIds
}

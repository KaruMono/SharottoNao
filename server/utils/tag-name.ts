import type { Prisma } from '@prisma/client'
import { normalizeTagName } from './tag-normalize'
import { pickTagColor } from './tag-color'
import { generateUniqueSlug } from './slug'

export interface PreparedTagAlias {
  name: string
  normalizedName: string
}

export interface PreparedTagNames {
  name: string
  normalizedName: string
  aliases: PreparedTagAlias[]
}

export type TagNameConflictField = 'name' | 'alias'
export type TagNameConflictOwner = 'tag' | 'alias'

export interface TagNameConflict {
  field: TagNameConflictField
  value: string
  occupiedBy: TagNameConflictOwner
}

export interface OccupiedTagNamespace {
  tagNames: readonly string[]
  aliasNames: readonly string[]
}

export interface ResolveOrCreateTagByNameInput {
  name: string
  isNsfw?: boolean
  color?: string
  description?: string | null
  isSystem?: boolean
}

export class InvalidCanonicalTagNameError extends Error {
  constructor() {
    super('标签名称归一化后不能为空')
    this.name = 'InvalidCanonicalTagNameError'
  }
}

export class TagNameConflictError extends Error {
  readonly conflict: TagNameConflict

  constructor(conflict: TagNameConflict) {
    const label = conflict.field === 'name' ? '标签名称' : '标签别名'
    super(`${label}“${conflict.value}”已被其他标签或别名占用`)
    this.name = 'TagNameConflictError'
    this.conflict = conflict
  }
}

export class TagUnavailableError extends Error {
  readonly statusCode = 409

  constructor(name: string, reason: 'archived' | 'system') {
    super(reason === 'archived'
      ? `标签“${name}”已归档，请先在标签管理中恢复`
      : `标签“${name}”由系统规则维护，不能作为人工标签添加`)
    this.name = 'TagUnavailableError'
  }
}

export function normalizeTagNamespaceKey(value: string): string {
  return normalizeTagName(value).toLowerCase()
}

/** Normalize the canonical name and deduplicate aliases within one tag. */
export function prepareTagNames(
  rawName: string,
  rawAliases: readonly string[],
): PreparedTagNames {
  const name = normalizeTagName(rawName)
  if (!name) throw new InvalidCanonicalTagNameError()

  const normalizedName = normalizeTagNamespaceKey(name)
  const seen = new Set([normalizedName])
  const aliases: PreparedTagAlias[] = []

  for (const rawAlias of rawAliases) {
    const alias = normalizeTagName(rawAlias)
    if (!alias) continue

    const normalizedAlias = normalizeTagNamespaceKey(alias)
    if (seen.has(normalizedAlias)) continue

    seen.add(normalizedAlias)
    aliases.push({ name: alias, normalizedName: normalizedAlias })
  }

  return { name, normalizedName, aliases }
}

/** Pure conflict classifier shared by database validation and unit tests. */
export function findTagNameConflict(
  prepared: PreparedTagNames,
  occupied: OccupiedTagNamespace,
): TagNameConflict | null {
  const occupiedTags = new Set(occupied.tagNames.map(normalizeTagNamespaceKey))
  const occupiedAliases = new Set(occupied.aliasNames.map(normalizeTagNamespaceKey))

  if (occupiedTags.has(prepared.normalizedName)) {
    return { field: 'name', value: prepared.name, occupiedBy: 'tag' }
  }
  if (occupiedAliases.has(prepared.normalizedName)) {
    return { field: 'name', value: prepared.name, occupiedBy: 'alias' }
  }

  for (const alias of prepared.aliases) {
    if (occupiedTags.has(alias.normalizedName)) {
      return { field: 'alias', value: alias.name, occupiedBy: 'tag' }
    }
    if (occupiedAliases.has(alias.normalizedName)) {
      return { field: 'alias', value: alias.name, occupiedBy: 'alias' }
    }
  }

  return null
}

export function buildTagNameConflictWhere(
  prepared: PreparedTagNames,
  excludeTagId?: number,
): {
  tags: Prisma.TagWhereInput
  aliases: Prisma.TagAliasWhereInput
} {
  const displayNames = [prepared.name, ...prepared.aliases.map(alias => alias.name)]
  const normalizedNames = [
    prepared.normalizedName,
    ...prepared.aliases.map(alias => alias.normalizedName),
  ]

  return {
    tags: {
      ...(excludeTagId !== undefined ? { id: { not: excludeTagId } } : {}),
      name: { in: displayNames, mode: 'insensitive' },
    },
    aliases: {
      ...(excludeTagId !== undefined ? { tagId: { not: excludeTagId } } : {}),
      normalizedName: { in: normalizedNames },
    },
  }
}

/** Serialize all admin changes to the shared canonical-name/alias namespace. */
export async function lockTagNameNamespaceInTransaction(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext('charlotte:tag-name-namespace'))
  `
}

/**
 * Assert that a complete canonical-name/alias set is free. Call this inside
 * the same transaction that writes Tag and TagAlias rows.
 */
export async function assertTagNamesAvailableInTransaction(
  tx: Prisma.TransactionClient,
  prepared: PreparedTagNames,
  excludeTagId?: number,
): Promise<void> {
  await lockTagNameNamespaceInTransaction(tx)
  const where = buildTagNameConflictWhere(prepared, excludeTagId)
  const [tags, aliases] = await Promise.all([
    tx.tag.findMany({
      where: where.tags,
      select: { name: true },
    }),
    tx.tagAlias.findMany({
      where: where.aliases,
      select: { name: true },
    }),
  ])

  const conflict = findTagNameConflict(prepared, {
    tagNames: tags.map(tag => tag.name),
    aliasNames: aliases.map(alias => alias.name),
  })
  if (conflict) throw new TagNameConflictError(conflict)
}

/** Find a canonical tag by either its display name or any normalized alias. */
export async function findTagByNameInTransaction(
  tx: Prisma.TransactionClient,
  rawName: string,
) {
  const name = normalizeTagName(rawName)
  if (!name) return null
  const normalizedName = normalizeTagNamespaceKey(name)

  return tx.tag.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { aliases: { some: { normalizedName } } },
      ],
    },
  })
}

/**
 * Resolve free-text input to an existing canonical tag (including aliases),
 * or create one while holding the global tag-name namespace lock.
 */
export async function resolveOrCreateTagByNameInTransaction(
  tx: Prisma.TransactionClient,
  input: ResolveOrCreateTagByNameInput,
) {
  const prepared = prepareTagNames(input.name, [])
  await lockTagNameNamespaceInTransaction(tx)

  const existing = await findTagByNameInTransaction(tx, prepared.name)
  if (existing) {
    if (existing.archivedAt) throw new TagUnavailableError(existing.name, 'archived')
    if (existing.isSystem) throw new TagUnavailableError(existing.name, 'system')
    return { tag: existing, created: false as const }
  }

  await assertTagNamesAvailableInTransaction(tx, prepared)
  const slug = await generateUniqueSlug(prepared.name, async (candidate) => {
    return Boolean(await tx.tag.findUnique({
      where: { slug: candidate },
      select: { id: true },
    }))
  })
  const tag = await tx.tag.create({
    data: {
      name: prepared.name,
      slug,
      isNsfw: input.isNsfw ?? false,
      color: input.color ?? pickTagColor(prepared.name),
      description: input.description,
      isSystem: input.isSystem ?? false,
    },
  })

  return { tag, created: true as const }
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'P2002',
  )
}

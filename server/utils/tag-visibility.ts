import type { Prisma } from '@prisma/client'
import type { NsfwMode } from './nsfw'

export interface TagVisibilityRecord {
  isNsfw: boolean
  archivedAt?: Date | null
}

export interface TagVisibilityOptions {
  includeArchived?: boolean
}

export interface ExistingGameTagVisibilityRecord {
  tagId: number
  tag: TagVisibilityRecord
}

/**
 * Public tag visibility intentionally differs from game filtering: NSFW mode
 * may browse both safe and adult tags, while SFW mode must never expose an
 * adult tag nested inside an otherwise-safe game response.
 */
export function isTagVisible(
  tag: TagVisibilityRecord,
  mode: NsfwMode,
  options: TagVisibilityOptions = {},
): boolean {
  if (!options.includeArchived && tag.archivedAt) return false
  if (mode === 'SFW' && tag.isNsfw) return false
  return true
}

/**
 * A full-form edit can only send back tags that were visible in that form.
 * Preserve existing hidden manual tags so SFW/archived filtering cannot turn
 * an unrelated edit into an implicit removal.
 */
export function mergeRequestedTagIdsPreservingHidden(
  requestedTagIds: readonly number[],
  existingTags: readonly ExistingGameTagVisibilityRecord[],
  mode: NsfwMode,
): number[] {
  const merged = new Set(
    requestedTagIds.filter(tagId => Number.isSafeInteger(tagId) && tagId > 0),
  )

  for (const existing of existingTags) {
    if (!isTagVisible(existing.tag, mode)) merged.add(existing.tagId)
  }

  return [...merged].sort((a, b) => a - b)
}

export function buildTagVisibilityWhere(
  mode: NsfwMode,
  options: TagVisibilityOptions = {},
): Prisma.TagWhereInput {
  return {
    ...(!options.includeArchived ? { archivedAt: null } : {}),
    ...(mode === 'SFW' ? { isNsfw: false } : {}),
  }
}

/** Use this as the `where` value of nested GameTag queries. */
export function buildGameTagVisibilityWhere(
  mode: NsfwMode,
  options: TagVisibilityOptions = {},
): Prisma.GameTagWhereInput {
  return {
    tag: buildTagVisibilityWhere(mode, options),
  }
}

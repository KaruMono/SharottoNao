import { Prisma, VndbTagStatus } from '@prisma/client'
import { lockVndbTagMappingInTransaction } from './vndb-tag-sync'

export type TagPurgeRejectionReason = 'missing' | 'system' | 'active'

export class TagPurgeRejectedError extends Error {
  readonly statusCode: 404 | 409
  readonly reason: TagPurgeRejectionReason
  readonly tagId: number

  constructor(input: {
    reason: TagPurgeRejectionReason
    tagId: number
    tagName?: string
  }) {
    const label = input.tagName ? `「${input.tagName}」` : `#${input.tagId}`
    const message = input.reason === 'missing'
      ? `标签 ${label} 不存在`
      : input.reason === 'system'
        ? `系统标签 ${label} 不能彻底删除`
        : `标签 ${label} 尚未归档，不能彻底删除`

    super(message)
    this.name = 'TagPurgeRejectedError'
    this.statusCode = input.reason === 'missing' ? 404 : 409
    this.reason = input.reason
    this.tagId = input.tagId
  }
}

export interface PurgeArchivedTagsResult {
  purgedCount: number
  removedGameAssociations: number
  resetVndbMappings: number
}

interface LockedTag {
  id: number
  name: string
  isSystem: boolean
  archivedAt: Date | null
}

function normalizeTagIds(ids: readonly number[]): number[] {
  return [...new Set(ids)]
    .filter(id => Number.isSafeInteger(id) && id > 0)
    .sort((a, b) => a - b)
}

/**
 * Permanently remove archived canonical tags while preserving raw VNDB data.
 * The caller owns the transaction and may append an operation log atomically.
 */
export async function purgeArchivedTagsInTransaction(
  tx: Prisma.TransactionClient,
  ids: readonly number[],
): Promise<PurgeArchivedTagsResult> {
  const tagIds = normalizeTagIds(ids)
  if (tagIds.length === 0) {
    throw new TypeError('At least one valid tag ID is required')
  }

  // Mapping changes and raw VNDB syncs use the other side of this advisory
  // lock, so the mapping counts and reset remain stable until commit.
  await lockVndbTagMappingInTransaction(tx)

  const lockedTags = await tx.$queryRaw<LockedTag[]>(Prisma.sql`
    SELECT "id", "name", "isSystem", "archivedAt"
    FROM "Tag"
    WHERE "id" IN (${Prisma.join(tagIds)})
    ORDER BY "id" ASC
    FOR UPDATE
  `)
  const tagsById = new Map(lockedTags.map(tag => [tag.id, tag]))

  for (const tagId of tagIds) {
    const tag = tagsById.get(tagId)
    if (!tag) {
      throw new TagPurgeRejectedError({ reason: 'missing', tagId })
    }
    if (tag.isSystem) {
      throw new TagPurgeRejectedError({ reason: 'system', tagId, tagName: tag.name })
    }
    if (!tag.archivedAt) {
      throw new TagPurgeRejectedError({ reason: 'active', tagId, tagName: tag.name })
    }
  }

  const removedGameAssociations = await tx.gameTag.count({
    where: { tagId: { in: tagIds } },
  })

  // Keep GameVndbTag intact. It references VndbTag, whose mapping is returned
  // to the review queue before the canonical Tag rows are deleted.
  const resetMappings = await tx.vndbTag.updateMany({
    where: { tagId: { in: tagIds } },
    data: {
      tagId: null,
      status: VndbTagStatus.PENDING,
    },
  })
  const deleted = await tx.tag.deleteMany({
    where: { id: { in: tagIds } },
  })

  if (deleted.count !== tagIds.length) {
    throw new Error(`Expected to purge ${tagIds.length} tags, deleted ${deleted.count}`)
  }

  return {
    purgedCount: deleted.count,
    removedGameAssociations,
    resetVndbMappings: resetMappings.count,
  }
}

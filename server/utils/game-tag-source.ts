import { GameTagSourceType, Prisma } from '@prisma/client'
import prisma from './prisma'

export interface GameTagSourceReplacementPlan {
  targetTagIds: number[]
  addedTagIds: number[]
  removedTagIds: number[]
  unchangedTagIds: number[]
}

export interface ReplaceGameTagSourceInput {
  gameId: number
  source: GameTagSourceType
  tagIds: readonly number[]
  alreadyLocked?: boolean
}

export interface SetGameTagSourceInput {
  gameId: number
  tagId: number
  source: GameTagSourceType
  enabled: boolean
}

export class ManualGameTagUnavailableError extends Error {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
    this.name = 'ManualGameTagUnavailableError'
  }
}

/** Normalize user/API input before it is used in compound keys. */
export function normalizeTagIds(tagIds: readonly number[]): number[] {
  return [...new Set(tagIds)]
    .filter(tagId => Number.isSafeInteger(tagId) && tagId > 0)
    .sort((a, b) => a - b)
}

/** Pure diff used by the transactional reconciler and its tests. */
export function planGameTagSourceReplacement(
  existingTagIds: readonly number[],
  requestedTagIds: readonly number[],
): GameTagSourceReplacementPlan {
  const existing = normalizeTagIds(existingTagIds)
  const targetTagIds = normalizeTagIds(requestedTagIds)
  const existingSet = new Set(existing)
  const targetSet = new Set(targetTagIds)

  return {
    targetTagIds,
    addedTagIds: targetTagIds.filter(tagId => !existingSet.has(tagId)),
    removedTagIds: existing.filter(tagId => !targetSet.has(tagId)),
    unchangedTagIds: targetTagIds.filter(tagId => existingSet.has(tagId)),
  }
}

export async function lockGameTagStateInTransaction(
  tx: Prisma.TransactionClient,
  gameId: number,
): Promise<void> {
  await lockGameTagStatesInTransaction(tx, [gameId])
}

/** Lock whichever requested games still exist and return their sorted IDs. */
export async function lockExistingGameTagStatesInTransaction(
  tx: Prisma.TransactionClient,
  gameIds: readonly number[],
): Promise<number[]> {
  const ids = normalizeTagIds(gameIds)
  if (ids.length === 0) return []

  const rows = await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`
      SELECT "id"
      FROM "Game"
      WHERE "id" IN (${Prisma.join(ids)})
      ORDER BY "id"
      FOR UPDATE
    `,
  )

  return rows.map(row => row.id)
}

/** Lock multiple games in a deterministic order to avoid sync/mapping deadlocks. */
export async function lockGameTagStatesInTransaction(
  tx: Prisma.TransactionClient,
  gameIds: readonly number[],
): Promise<void> {
  const ids = normalizeTagIds(gameIds)
  if (ids.length === 0) return

  // Source replacements for the same games must be serialized. Without these
  // locks, concurrent syncs can each calculate a diff from stale source rows.
  const lockedIds = await lockExistingGameTagStatesInTransaction(tx, ids)
  if (lockedIds.length !== ids.length) {
    const found = new Set(lockedIds)
    const missing = ids.filter(id => !found.has(id))
    throw new Error(`Game ${missing.join(', ')} does not exist`)
  }
}

async function deleteOrphanedGameTags(
  tx: Prisma.TransactionClient,
  gameId: number,
  candidateTagIds: readonly number[],
): Promise<number> {
  if (candidateTagIds.length === 0) return 0

  const result = await tx.gameTag.deleteMany({
    where: {
      gameId,
      tagId: { in: [...candidateTagIds] },
      sources: { none: {} },
    },
  })

  return result.count
}

async function assertManualTagIdsAvailable(
  tx: Prisma.TransactionClient,
  tagIds: readonly number[],
): Promise<void> {
  if (tagIds.length === 0) return

  const tags = await tx.tag.findMany({
    where: { id: { in: [...tagIds] } },
    select: { id: true, name: true, isSystem: true, archivedAt: true },
  })
  const foundIds = new Set(tags.map(tag => tag.id))
  const missingIds = tagIds.filter(tagId => !foundIds.has(tagId))
  if (missingIds.length > 0) {
    throw new ManualGameTagUnavailableError(`标签 ${missingIds.join(', ')} 不存在`)
  }

  const unavailable = tags.find(tag => tag.isSystem || tag.archivedAt)
  if (unavailable) {
    throw new ManualGameTagUnavailableError(unavailable.isSystem
      ? `系统标签“${unavailable.name}”不能作为人工标签添加`
      : `标签“${unavailable.name}”已归档，请先在标签管理中恢复`)
  }
}

/**
 * Replace exactly one source's tag set inside an existing transaction.
 * Other sources are untouched and a display GameTag is removed only when it
 * no longer has MANUAL, VNDB, or SYSTEM ownership.
 */
export async function replaceGameTagSourceInTransaction(
  tx: Prisma.TransactionClient,
  input: ReplaceGameTagSourceInput,
): Promise<GameTagSourceReplacementPlan> {
  if (!input.alreadyLocked) {
    await lockGameTagStateInTransaction(tx, input.gameId)
  }

  const existingRows = await tx.gameTagSource.findMany({
    where: {
      gameId: input.gameId,
      source: input.source,
    },
    select: { tagId: true },
  })
  const plan = planGameTagSourceReplacement(
    existingRows.map(row => row.tagId),
    input.tagIds,
  )

  // Preserve legacy/archived associations that were already selected, but
  // reject attempts to add an unavailable tag through a forged API payload.
  if (input.source === GameTagSourceType.MANUAL) {
    await assertManualTagIdsAvailable(tx, plan.addedTagIds)
  }

  if (plan.addedTagIds.length > 0) {
    await tx.gameTag.createMany({
      data: plan.addedTagIds.map(tagId => ({ gameId: input.gameId, tagId })),
      skipDuplicates: true,
    })
    await tx.gameTagSource.createMany({
      data: plan.addedTagIds.map(tagId => ({
        gameId: input.gameId,
        tagId,
        source: input.source,
      })),
      skipDuplicates: true,
    })
  }

  if (plan.removedTagIds.length > 0) {
    await tx.gameTagSource.deleteMany({
      where: {
        gameId: input.gameId,
        source: input.source,
        tagId: { in: plan.removedTagIds },
      },
    })
    await deleteOrphanedGameTags(tx, input.gameId, plan.removedTagIds)
  }

  return plan
}

/** Replace one source in its own transaction. */
export async function replaceGameTagSource(
  input: ReplaceGameTagSourceInput,
): Promise<GameTagSourceReplacementPlan> {
  return prisma.$transaction(tx => replaceGameTagSourceInTransaction(tx, input))
}

/** Add or remove one source without replacing that source's other tags. */
export async function setGameTagSourceInTransaction(
  tx: Prisma.TransactionClient,
  input: SetGameTagSourceInput,
): Promise<void> {
  await lockGameTagStateInTransaction(tx, input.gameId)

  const compoundKey = {
    gameId: input.gameId,
    tagId: input.tagId,
  }

  if (input.enabled) {
    if (input.source === GameTagSourceType.MANUAL) {
      await assertManualTagIdsAvailable(tx, [input.tagId])
    }
    await tx.gameTag.upsert({
      where: { gameId_tagId: compoundKey },
      create: compoundKey,
      update: {},
    })
    await tx.gameTagSource.upsert({
      where: {
        gameId_tagId_source: {
          ...compoundKey,
          source: input.source,
        },
      },
      create: {
        ...compoundKey,
        source: input.source,
      },
      update: {},
    })
    return
  }

  await tx.gameTagSource.deleteMany({
    where: {
      ...compoundKey,
      source: input.source,
    },
  })
  await deleteOrphanedGameTags(tx, input.gameId, [input.tagId])
}

/** Add or remove one source in its own transaction. */
export async function setGameTagSource(input: SetGameTagSourceInput): Promise<void> {
  await prisma.$transaction(tx => setGameTagSourceInTransaction(tx, input))
}

export function replaceManualGameTags(gameId: number, tagIds: readonly number[]) {
  return replaceGameTagSource({ gameId, tagIds, source: GameTagSourceType.MANUAL })
}

export function replaceManualGameTagsInTransaction(
  tx: Prisma.TransactionClient,
  gameId: number,
  tagIds: readonly number[],
) {
  return replaceGameTagSourceInTransaction(tx, {
    gameId,
    tagIds,
    source: GameTagSourceType.MANUAL,
  })
}

export function setSystemGameTag(gameId: number, tagId: number, enabled: boolean) {
  return setGameTagSource({
    gameId,
    tagId,
    enabled,
    source: GameTagSourceType.SYSTEM,
  })
}

export function setSystemGameTagInTransaction(
  tx: Prisma.TransactionClient,
  gameId: number,
  tagId: number,
  enabled: boolean,
) {
  return setGameTagSourceInTransaction(tx, {
    gameId,
    tagId,
    enabled,
    source: GameTagSourceType.SYSTEM,
  })
}

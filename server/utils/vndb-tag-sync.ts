import {
  GameTagSourceType,
  Prisma,
  TagDisplayTier,
  VndbTagStatus,
} from '@prisma/client'
import prisma from './prisma'
import {
  lockGameTagStateInTransaction,
  lockGameTagStatesInTransaction,
  normalizeTagIds,
  replaceGameTagSourceInTransaction,
  type GameTagSourceReplacementPlan,
} from './game-tag-source'

export interface VndbTagInput {
  id: string
  name: string
  rating: number
  spoiler: number
  category?: string | null
}

export interface NormalizedVndbTag {
  id: string
  nameEn: string
  rating: number
  spoiler: number
  category?: 'cont' | 'ero' | 'tech'
}

export interface VndbTagSyncPolicy {
  minRating: number
  maxSpoiler: number
  includeNsfw: boolean
  nsfwMinRating: number
}

export interface VndbMappedTagCandidate {
  vndbTagId: string
  tagId: number | null
  status: VndbTagStatus
  displayTier: TagDisplayTier
  rating: number
  spoiler: number
  isNsfw: boolean
  affectsGameNsfw: boolean
  canonicalTagIsNsfw: boolean
  canonicalTagArchivedAt: Date | null
}

export interface EligibleCanonicalTag {
  tagId: number
  displayTier: TagDisplayTier
}

export interface ReconcileVndbTagSourceInput {
  gameId: number
  policy?: Partial<VndbTagSyncPolicy>
  alreadyLocked?: boolean
}

export interface ReconcileVndbTagSourcesInput {
  gameIds: readonly number[]
  policy?: Partial<VndbTagSyncPolicy>
  alreadyLocked?: boolean
}

export interface ReconcileVndbTagSourceResult {
  appliedTagIds: number[]
  mappedAssociationCount: number
  suggestsGameNsfw: boolean
  sourceChanges: GameTagSourceReplacementPlan
}

export interface SyncVndbTagsForGameInput {
  gameId: number
  tags: readonly VndbTagInput[]
  policy?: Partial<VndbTagSyncPolicy>
  syncedAt?: Date
  expectedVndbId?: string | null
}

export interface SyncVndbTagsForGameResult extends ReconcileVndbTagSourceResult {
  rawTagCount: number
  pendingVndbTagIds: string[]
  ignoredVndbTagIds: string[]
  syncedAt: Date
}

export class VndbTagSyncTargetChangedError extends Error {
  readonly statusCode = 409

  constructor() {
    super('游戏的 VNDB ID 已在同步期间发生变化，请重新加载后再试')
    this.name = 'VndbTagSyncTargetChangedError'
  }
}

export const DEFAULT_VNDB_TAG_SYNC_POLICY: Readonly<VndbTagSyncPolicy> = Object.freeze({
  minRating: 1,
  maxSpoiler: 0,
  includeNsfw: true,
  nsfwMinRating: 1.5,
})

// Category `ero` is VNDB's authoritative adult-content classification. Keep
// the legacy IDs as a fallback for older or incomplete upstream payloads.
// These signals are only defaults on first discovery; later syncs preserve
// the administrator-controlled safety policy.
export const KNOWN_ADULT_VNDB_TAG_IDS = new Set(['g235', 'g542', 'g254'])

export function isAdultVndbTag(tag: Pick<VndbTagInput, 'id' | 'category'>): boolean {
  return tag.category?.trim().toLowerCase() === 'ero'
    || KNOWN_ADULT_VNDB_TAG_IDS.has(tag.id.trim().toLowerCase())
}

const VNDB_TAG_MAPPING_LOCK_KEY = 'charlotte:vndb-tag-mapping'

/**
 * Raw syncs may run concurrently, but mapping changes need a stable view of
 * every GameVndbTag row. Acquire this before locking or updating an existing
 * Game row when the surrounding transaction will call the sync helper.
 */
export async function lockVndbTagSyncInTransaction(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock_shared(hashtext(${VNDB_TAG_MAPPING_LOCK_KEY}))
  `
}

/** Block raw syncs while one mapping is propagated to all associated games. */
export async function lockVndbTagMappingInTransaction(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${VNDB_TAG_MAPPING_LOCK_KEY}))
  `
}

export function resolveVndbTagSyncPolicy(
  policy: Partial<VndbTagSyncPolicy> = {},
): VndbTagSyncPolicy {
  const resolved = {
    minRating: policy.minRating ?? DEFAULT_VNDB_TAG_SYNC_POLICY.minRating,
    maxSpoiler: policy.maxSpoiler ?? DEFAULT_VNDB_TAG_SYNC_POLICY.maxSpoiler,
    includeNsfw: policy.includeNsfw ?? DEFAULT_VNDB_TAG_SYNC_POLICY.includeNsfw,
    nsfwMinRating: policy.nsfwMinRating ?? DEFAULT_VNDB_TAG_SYNC_POLICY.nsfwMinRating,
  }

  if (!Number.isFinite(resolved.minRating) || resolved.minRating < 0 || resolved.minRating > 3) {
    throw new RangeError('VNDB tag minRating must be between 0 and 3')
  }
  if (!Number.isInteger(resolved.maxSpoiler) || resolved.maxSpoiler < 0 || resolved.maxSpoiler > 2) {
    throw new RangeError('VNDB tag maxSpoiler must be an integer between 0 and 2')
  }
  if (!Number.isFinite(resolved.nsfwMinRating)
    || resolved.nsfwMinRating < 0
    || resolved.nsfwMinRating > 3) {
    throw new RangeError('VNDB tag nsfwMinRating must be between 0 and 3')
  }
  if (typeof resolved.includeNsfw !== 'boolean') {
    throw new TypeError('VNDB tag includeNsfw must be a boolean')
  }

  return resolved
}

export function normalizeVndbTags(tags: readonly VndbTagInput[]): NormalizedVndbTag[] {
  const normalized = new Map<string, NormalizedVndbTag>()

  for (const tag of tags) {
    const id = tag.id.trim().toLowerCase()
    const nameEn = tag.name.trim()
    const rawCategory = tag.category?.trim().toLowerCase()
    const category = rawCategory === 'cont' || rawCategory === 'ero' || rawCategory === 'tech'
      ? rawCategory
      : undefined

    if (!/^g\d+$/.test(id)) {
      throw new TypeError(`Invalid VNDB tag ID: ${tag.id}`)
    }
    if (!nameEn) {
      throw new TypeError(`VNDB tag ${id} has an empty name`)
    }
    if (!Number.isFinite(tag.rating) || tag.rating < 0 || tag.rating > 3) {
      throw new RangeError(`VNDB tag ${id} rating must be between 0 and 3`)
    }
    if (!Number.isInteger(tag.spoiler) || tag.spoiler < 0 || tag.spoiler > 2) {
      throw new RangeError(`VNDB tag ${id} spoiler must be an integer between 0 and 2`)
    }
    if (normalized.has(id)) {
      throw new TypeError(`Duplicate VNDB tag ID: ${id}`)
    }

    normalized.set(id, {
      id,
      nameEn: nameEn.slice(0, 255),
      rating: tag.rating,
      spoiler: tag.spoiler,
      ...(category && { category }),
    })
  }

  return [...normalized.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

export function selectEligibleCanonicalTagIds(
  candidates: readonly VndbMappedTagCandidate[],
  policy: Partial<VndbTagSyncPolicy> = {},
): number[] {
  return selectEligibleCanonicalTags(candidates, policy).map(tag => tag.tagId)
}

/** Collapse multiple VNDB mappings to one canonical tag; primary always wins. */
export function selectEligibleCanonicalTags(
  candidates: readonly VndbMappedTagCandidate[],
  policy: Partial<VndbTagSyncPolicy> = {},
): EligibleCanonicalTag[] {
  const resolved = resolveVndbTagSyncPolicy(policy)
  const eligible = candidates
    .filter(candidate => candidate.status === VndbTagStatus.MAPPED)
    .filter(candidate => candidate.tagId !== null && candidate.tagId > 0)
    .filter(candidate => candidate.rating >= resolved.minRating)
    .filter(candidate => candidate.spoiler <= resolved.maxSpoiler)
    .filter(candidate => resolved.includeNsfw
      || (!candidate.isNsfw && !candidate.canonicalTagIsNsfw))
  const tiers = new Map<number, TagDisplayTier>()
  for (const candidate of eligible) {
    const tagId = candidate.tagId as number
    const currentTier = tiers.get(tagId)
    if (!currentTier || candidate.displayTier === TagDisplayTier.PRIMARY) {
      tiers.set(tagId, candidate.displayTier)
    }
  }

  return [...tiers]
    .sort(([a], [b]) => a - b)
    .map(([tagId, displayTier]) => ({ tagId, displayTier }))
}

export function hasVndbGameNsfwSignal(
  candidates: readonly VndbMappedTagCandidate[],
  policy: Partial<VndbTagSyncPolicy> = {},
): boolean {
  const resolved = resolveVndbTagSyncPolicy(policy)
  return candidates.some(candidate => (
    candidate.affectsGameNsfw && candidate.rating >= resolved.nsfwMinRating
  ))
}

async function loadVndbTagCandidates(
  tx: Prisma.TransactionClient,
  gameId: number,
): Promise<VndbMappedTagCandidate[]> {
  const rows = await tx.gameVndbTag.findMany({
    where: { gameId },
    select: {
      vndbTagId: true,
      rating: true,
      spoiler: true,
      vndbTag: {
        select: {
          tagId: true,
          status: true,
          displayTier: true,
          isNsfw: true,
          affectsGameNsfw: true,
          tag: {
            select: {
              isNsfw: true,
              archivedAt: true,
            },
          },
        },
      },
    },
    orderBy: { vndbTagId: 'asc' },
  })

  return rows.map(row => ({
    vndbTagId: row.vndbTagId,
    tagId: row.vndbTag.tagId,
    status: row.vndbTag.status,
    displayTier: row.vndbTag.displayTier,
    rating: row.rating,
    spoiler: row.spoiler,
    isNsfw: row.vndbTag.isNsfw,
    affectsGameNsfw: row.vndbTag.affectsGameNsfw,
    canonicalTagIsNsfw: row.vndbTag.tag?.isNsfw ?? false,
    canonicalTagArchivedAt: row.vndbTag.tag?.archivedAt ?? null,
  }))
}

/** Rebuild the VNDB source from already-persisted raw associations. */
export async function reconcileVndbTagSourceInTransaction(
  tx: Prisma.TransactionClient,
  input: ReconcileVndbTagSourceInput,
): Promise<ReconcileVndbTagSourceResult> {
  if (!input.alreadyLocked) {
    await lockGameTagStateInTransaction(tx, input.gameId)
  }

  const policy = resolveVndbTagSyncPolicy(input.policy)
  const candidates = await loadVndbTagCandidates(tx, input.gameId)
  const eligibleTags = selectEligibleCanonicalTags(candidates, policy)
  const appliedTagIds = eligibleTags.map(tag => tag.tagId)
  const sourceChanges = await replaceGameTagSourceInTransaction(tx, {
    gameId: input.gameId,
    source: GameTagSourceType.VNDB,
    tagIds: appliedTagIds,
    alreadyLocked: true,
  })

  for (const displayTier of [TagDisplayTier.PRIMARY, TagDisplayTier.SECONDARY]) {
    const tagIds = eligibleTags
      .filter(tag => tag.displayTier === displayTier)
      .map(tag => tag.tagId)
    if (tagIds.length > 0) {
      await tx.gameTagSource.updateMany({
        where: {
          gameId: input.gameId,
          source: GameTagSourceType.VNDB,
          tagId: { in: tagIds },
        },
        data: { displayTier },
      })
    }
  }

  return {
    appliedTagIds,
    mappedAssociationCount: candidates.filter(candidate => (
      candidate.status === VndbTagStatus.MAPPED && candidate.tagId !== null
    )).length,
    suggestsGameNsfw: hasVndbGameNsfwSignal(candidates, policy),
    sourceChanges,
  }
}

/**
 * Rebuild VNDB-derived sources for many games with set-based SQL. Mapping a
 * common VNDB tag can affect thousands of games, so issuing a full Prisma
 * reconciliation loop per game would exceed the interactive transaction
 * timeout while holding every affected Game row lock.
 */
export async function reconcileVndbTagSourcesInTransaction(
  tx: Prisma.TransactionClient,
  input: ReconcileVndbTagSourcesInput,
): Promise<void> {
  const gameIds = normalizeTagIds(input.gameIds)
  if (gameIds.length === 0) return
  if (!input.alreadyLocked) {
    await lockGameTagStatesInTransaction(tx, gameIds)
  }

  const policy = resolveVndbTagSyncPolicy(input.policy)
  const desiredRows = Prisma.sql`
    SELECT
      gvt."gameId",
      vt."tagId",
      CASE
        WHEN BOOL_OR(vt."displayTier" = 'PRIMARY'::"TagDisplayTier")
          THEN 'PRIMARY'::"TagDisplayTier"
        ELSE 'SECONDARY'::"TagDisplayTier"
      END AS "displayTier"
    FROM "GameVndbTag" AS gvt
    INNER JOIN "VndbTag" AS vt ON vt."id" = gvt."vndbTagId"
    INNER JOIN "Tag" AS tag ON tag."id" = vt."tagId"
    WHERE gvt."gameId" IN (${Prisma.join(gameIds)})
      AND vt."status" = 'MAPPED'::"VndbTagStatus"
      AND vt."tagId" IS NOT NULL
      AND gvt."rating" >= ${policy.minRating}
      AND gvt."spoiler" <= ${policy.maxSpoiler}
      AND (${policy.includeNsfw} OR (NOT vt."isNsfw" AND NOT tag."isNsfw"))
    GROUP BY gvt."gameId", vt."tagId"
  `

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "GameTag" ("gameId", "tagId")
    SELECT desired."gameId", desired."tagId"
    FROM (${desiredRows}) AS desired
    ON CONFLICT ("gameId", "tagId") DO NOTHING
  `)
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "GameTagSource" ("gameId", "tagId", "source", "displayTier")
    SELECT
      desired."gameId",
      desired."tagId",
      'VNDB'::"GameTagSourceType",
      desired."displayTier"
    FROM (${desiredRows}) AS desired
    ON CONFLICT ("gameId", "tagId", "source") DO UPDATE SET
      "displayTier" = EXCLUDED."displayTier"
    WHERE "GameTagSource"."displayTier" IS DISTINCT FROM EXCLUDED."displayTier"
  `)
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "GameTagSource" AS gts
    WHERE gts."source" = 'VNDB'::"GameTagSourceType"
      AND gts."gameId" IN (${Prisma.join(gameIds)})
      AND NOT EXISTS (
        SELECT 1
        FROM (${desiredRows}) AS desired
        WHERE desired."gameId" = gts."gameId"
          AND desired."tagId" = gts."tagId"
      )
  `)
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "GameTag" AS gt
    WHERE gt."gameId" IN (${Prisma.join(gameIds)})
      AND NOT EXISTS (
        SELECT 1
        FROM "GameTagSource" AS source
        WHERE source."gameId" = gt."gameId"
          AND source."tagId" = gt."tagId"
      )
  `)
}

export function reconcileVndbTagSource(
  input: Omit<ReconcileVndbTagSourceInput, 'alreadyLocked'>,
): Promise<ReconcileVndbTagSourceResult> {
  return prisma.$transaction(async (tx) => {
    await lockVndbTagSyncInTransaction(tx)
    return reconcileVndbTagSourceInTransaction(tx, input)
  })
}

async function upsertVndbTagDictionaryInTransaction(
  tx: Prisma.TransactionClient,
  tags: readonly NormalizedVndbTag[],
  syncedAt: Date,
): Promise<void> {
  if (tags.length === 0) return

  const values = tags.map((tag) => {
    const knownAdultTag = isAdultVndbTag(tag)
    return Prisma.sql`(
      ${tag.id}, ${tag.nameEn}, ${tag.category ?? null},
      ${knownAdultTag}, ${knownAdultTag},
      ${syncedAt}, ${syncedAt}, ${syncedAt}
    )`
  })

  // Mapping and status remain administrator-controlled. VNDB category/name
  // are refreshed, while authoritative adult signals only escalate safety.
  await tx.$executeRaw(Prisma.sql`
    WITH upserted AS (
      INSERT INTO "VndbTag" (
        "id", "nameEn", "category", "isNsfw", "affectsGameNsfw",
        "lastSeenAt", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("id") DO UPDATE SET
        "nameEn" = EXCLUDED."nameEn",
        "category" = COALESCE(EXCLUDED."category", "VndbTag"."category"),
        "isNsfw" = "VndbTag"."isNsfw" OR EXCLUDED."isNsfw",
        "affectsGameNsfw" = "VndbTag"."affectsGameNsfw" OR EXCLUDED."affectsGameNsfw",
        "lastSeenAt" = GREATEST("VndbTag"."lastSeenAt", EXCLUDED."lastSeenAt"),
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "tagId", "status", "isNsfw"
    )
    UPDATE "Tag" AS tag
    SET "isNsfw" = true,
        "updatedAt" = GREATEST(tag."updatedAt", ${syncedAt})
    FROM upserted
    WHERE upserted."tagId" = tag."id"
      AND upserted."status" = 'MAPPED'::"VndbTagStatus"
      AND upserted."isNsfw" = true
      AND tag."isNsfw" = false
  `)
}

/**
 * Persist the exact raw VNDB tag snapshot and reconcile the derived VNDB
 * source. English-name refreshes never touch canonical Chinese Tag fields or
 * administrator-controlled mappings/safety flags.
 */
export async function syncVndbTagsForGameInTransaction(
  tx: Prisma.TransactionClient,
  input: SyncVndbTagsForGameInput,
): Promise<SyncVndbTagsForGameResult> {
  const tags = normalizeVndbTags(input.tags)
  const policy = resolveVndbTagSyncPolicy(input.policy)
  const syncedAt = input.syncedAt ? new Date(input.syncedAt) : new Date()

  if (Number.isNaN(syncedAt.getTime())) {
    throw new TypeError('VNDB tag syncedAt must be a valid date')
  }

  await lockVndbTagSyncInTransaction(tx)
  await lockGameTagStateInTransaction(tx, input.gameId)

  if (input.expectedVndbId !== undefined) {
    const game = await tx.game.findUnique({
      where: { id: input.gameId },
      select: { vndbId: true, deletedAt: true },
    })
    const expectedVndbId = input.expectedVndbId?.trim().toLowerCase() || null
    if (!game || game.deletedAt || (game.vndbId?.trim().toLowerCase() || null) !== expectedVndbId) {
      throw new VndbTagSyncTargetChangedError()
    }
  }

  await upsertVndbTagDictionaryInTransaction(tx, tags, syncedAt)
  const currentIds = tags.map(tag => tag.id)
  await tx.gameVndbTag.deleteMany({
    where: { gameId: input.gameId },
  })
  if (tags.length > 0) {
    await tx.gameVndbTag.createMany({
      data: tags.map(tag => ({
        gameId: input.gameId,
        vndbTagId: tag.id,
        rating: tag.rating,
        spoiler: tag.spoiler,
        fetchedAt: syncedAt,
      })),
    })
  }

  const reconciliation = await reconcileVndbTagSourceInTransaction(tx, {
    gameId: input.gameId,
    policy,
    alreadyLocked: true,
  })

  await tx.game.update({
    where: { id: input.gameId },
    data: { vndbTagsSyncedAt: syncedAt },
  })

  const storedTags = await tx.vndbTag.findMany({
    where: { id: { in: currentIds } },
    select: { id: true, status: true, tagId: true },
    orderBy: { id: 'asc' },
  })

  return {
    ...reconciliation,
    rawTagCount: tags.length,
    pendingVndbTagIds: storedTags
      .filter(tag => tag.status === VndbTagStatus.PENDING
        || (tag.status === VndbTagStatus.MAPPED && tag.tagId === null))
      .map(tag => tag.id),
    ignoredVndbTagIds: storedTags
      .filter(tag => tag.status === VndbTagStatus.IGNORED)
      .map(tag => tag.id),
    syncedAt,
  }
}

export function syncVndbTagsForGame(
  input: SyncVndbTagsForGameInput,
): Promise<SyncVndbTagsForGameResult> {
  return prisma.$transaction(tx => syncVndbTagsForGameInTransaction(tx, input))
}

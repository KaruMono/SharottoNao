import { TagDisplayTier, VndbTagStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  hasVndbGameNsfwSignal,
  isAdultVndbTag,
  normalizeVndbTags,
  reconcileVndbTagSourceInTransaction,
  reconcileVndbTagSourcesInTransaction,
  resolveVndbTagSyncPolicy,
  selectEligibleCanonicalTagIds,
  selectEligibleCanonicalTags,
  syncVndbTagsForGameInTransaction,
  type VndbMappedTagCandidate,
} from '../vndb-tag-sync'

function candidate(
  overrides: Partial<VndbMappedTagCandidate> = {},
): VndbMappedTagCandidate {
  return {
    vndbTagId: 'g1',
    tagId: 10,
    status: VndbTagStatus.MAPPED,
    displayTier: TagDisplayTier.PRIMARY,
    rating: 2,
    spoiler: 0,
    isNsfw: false,
    affectsGameNsfw: false,
    canonicalTagIsNsfw: false,
    canonicalTagArchivedAt: null,
    ...overrides,
  }
}

describe('VNDB tag normalization', () => {
  it('normalizes IDs and names and sorts by stable VNDB ID', () => {
    expect(normalizeVndbTags([
      { id: 'G20', name: ' Second ', rating: 1.2, spoiler: 1, category: ' ERO ' },
      { id: 'g3', name: 'First', rating: 2, spoiler: 0 },
    ])).toEqual([
      { id: 'g20', nameEn: 'Second', rating: 1.2, spoiler: 1, category: 'ero' },
      { id: 'g3', nameEn: 'First', rating: 2, spoiler: 0 },
    ])
  })

  it('uses the official ero category with legacy IDs only as a fallback', () => {
    expect(isAdultVndbTag({ id: 'g214', category: 'ero' })).toBe(true)
    expect(isAdultVndbTag({ id: 'g235', category: 'cont' })).toBe(true)
    expect(isAdultVndbTag({ id: 'g214', category: 'cont' })).toBe(false)
  })

  it('rejects duplicate or malformed upstream data', () => {
    expect(() => normalizeVndbTags([
      { id: 'g1', name: 'One', rating: 1, spoiler: 0 },
      { id: 'G1', name: 'Duplicate', rating: 2, spoiler: 0 },
    ])).toThrow('Duplicate VNDB tag ID')

    expect(() => normalizeVndbTags([
      { id: 'tag-1', name: 'Bad', rating: 1, spoiler: 0 },
    ])).toThrow('Invalid VNDB tag ID')
  })
})

describe('VNDB tag policy', () => {
  it('merges partial policy with safe defaults and validates ranges', () => {
    expect(resolveVndbTagSyncPolicy({ minRating: 1.25 })).toEqual({
      minRating: 1.25,
      maxSpoiler: 0,
      includeNsfw: true,
      nsfwMinRating: 1.5,
    })
    expect(() => resolveVndbTagSyncPolicy({ maxSpoiler: 3 })).toThrow(RangeError)
  })

  it('applies mapping, rating, spoiler, source-preservation, and adult rules', () => {
    const candidates = [
      candidate({ vndbTagId: 'g1', tagId: 10 }),
      candidate({ vndbTagId: 'g2', tagId: 10, rating: 2.5 }),
      candidate({ vndbTagId: 'g3', tagId: 11, rating: 0.9 }),
      candidate({ vndbTagId: 'g4', tagId: 12, spoiler: 1 }),
      candidate({ vndbTagId: 'g5', tagId: 13, status: VndbTagStatus.IGNORED }),
      candidate({ vndbTagId: 'g6', tagId: 14, canonicalTagArchivedAt: new Date() }),
      candidate({ vndbTagId: 'g7', tagId: 15, isNsfw: true }),
      candidate({ vndbTagId: 'g8', tagId: 16, canonicalTagIsNsfw: true }),
    ]

    // Archive is a visibility state; retaining the source makes restore exact.
    expect(selectEligibleCanonicalTagIds(candidates)).toEqual([10, 14, 15, 16])
    expect(selectEligibleCanonicalTagIds(candidates, { includeNsfw: false })).toEqual([10, 14])
    expect(selectEligibleCanonicalTagIds(candidates, { maxSpoiler: 1 })).toEqual([10, 12, 14, 15, 16])
  })

  it('collapses duplicate canonical mappings with primary taking precedence', () => {
    const candidates = [
      candidate({ vndbTagId: 'g1', tagId: 10, displayTier: TagDisplayTier.SECONDARY }),
      candidate({ vndbTagId: 'g2', tagId: 10, displayTier: TagDisplayTier.PRIMARY }),
      candidate({ vndbTagId: 'g3', tagId: 11, displayTier: TagDisplayTier.SECONDARY }),
    ]

    expect(selectEligibleCanonicalTags(candidates)).toEqual([
      { tagId: 10, displayTier: TagDisplayTier.PRIMARY },
      { tagId: 11, displayTier: TagDisplayTier.SECONDARY },
    ])
    expect(selectEligibleCanonicalTagIds(candidates)).toEqual([10, 11])
  })

  it('returns a game-level adult suggestion without changing the game', () => {
    expect(hasVndbGameNsfwSignal([
      candidate({ affectsGameNsfw: true, rating: 1.49 }),
      candidate({ affectsGameNsfw: true, rating: 1.5, spoiler: 2 }),
    ])).toBe(true)
    expect(hasVndbGameNsfwSignal([
      candidate({ affectsGameNsfw: true, rating: 1.49 }),
    ])).toBe(false)
  })
})

describe('VNDB tag persistence', () => {
  it('updates single-game source tiers after collapsing canonical mappings', async () => {
    const mappedTag = (tagId: number, displayTier: TagDisplayTier) => ({
      status: VndbTagStatus.MAPPED,
      tagId,
      displayTier,
      isNsfw: false,
      affectsGameNsfw: false,
      tag: { isNsfw: false, archivedAt: null },
    })
    const tx = {
      gameVndbTag: {
        findMany: vi.fn().mockResolvedValue([
          { vndbTagId: 'g1', rating: 2, spoiler: 0, vndbTag: mappedTag(10, TagDisplayTier.SECONDARY) },
          { vndbTagId: 'g2', rating: 2, spoiler: 0, vndbTag: mappedTag(10, TagDisplayTier.PRIMARY) },
          { vndbTagId: 'g3', rating: 2, spoiler: 0, vndbTag: mappedTag(11, TagDisplayTier.SECONDARY) },
        ]),
      },
      gameTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
    }

    const result = await reconcileVndbTagSourceInTransaction(tx as never, {
      gameId: 12,
      alreadyLocked: true,
    })

    expect(result.appliedTagIds).toEqual([10, 11])
    expect(tx.gameTagSource.updateMany).toHaveBeenNthCalledWith(1, {
      where: { gameId: 12, source: 'VNDB', tagId: { in: [10] } },
      data: { displayTier: TagDisplayTier.PRIMARY },
    })
    expect(tx.gameTagSource.updateMany).toHaveBeenNthCalledWith(2, {
      where: { gameId: 12, source: 'VNDB', tagId: { in: [11] } },
      data: { displayTier: TagDisplayTier.SECONDARY },
    })
  })

  it('persists one raw snapshot with bulk writes instead of per-tag upserts', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 12 }]),
      $executeRaw: vi.fn().mockResolvedValue(2),
      gameVndbTag: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      gameTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      game: { update: vi.fn().mockResolvedValue({}) },
      vndbTag: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'g1', status: VndbTagStatus.PENDING, tagId: null },
          { id: 'g2', status: VndbTagStatus.PENDING, tagId: null },
        ]),
      },
    }

    const result = await syncVndbTagsForGameInTransaction(tx as never, {
      gameId: 12,
      tags: [
        { id: 'g1', name: 'First', rating: 2, spoiler: 0 },
        { id: 'g2', name: 'Second', rating: 1.5, spoiler: 0 },
      ],
    })

    // One advisory lock plus one dictionary UPSERT/Tag safety promotion,
    // regardless of tag count.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
    const dictionarySql = (tx.$executeRaw.mock.calls[1]?.[0] as { sql: string }).sql
    expect(dictionarySql).toContain('"category"')
    expect(dictionarySql).toContain('"VndbTag"."isNsfw" OR EXCLUDED."isNsfw"')
    expect(dictionarySql).toContain('UPDATE "Tag" AS tag')
    expect(tx.gameVndbTag.deleteMany).toHaveBeenCalledWith({ where: { gameId: 12 } })
    expect(tx.gameVndbTag.createMany).toHaveBeenCalledTimes(1)
    expect(result.pendingVndbTagIds).toEqual(['g1', 'g2'])
  })

  it('reconciles a mapping across 1500 games with four set-based statements', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(0) }
    const gameIds = Array.from({ length: 1500 }, (_, index) => index + 1)

    await reconcileVndbTagSourcesInTransaction(tx as never, {
      gameIds: [...gameIds, 1500],
      alreadyLocked: true,
    })

    expect(tx.$executeRaw).toHaveBeenCalledTimes(4)
    const firstStatement = tx.$executeRaw.mock.calls[0]?.[0] as { values: unknown[] }
    expect(firstStatement.values).toEqual(expect.arrayContaining([1, 1500]))
    const sql = tx.$executeRaw.mock.calls
      .map(([statement]) => (statement as { sql: string }).sql)
      .join('\n')
    expect(sql).not.toContain('tag."archivedAt"')
    expect(sql).toContain('BOOL_OR(vt."displayTier" = \'PRIMARY\'::"TagDisplayTier")')
    expect(sql).toContain('"displayTier" = EXCLUDED."displayTier"')
    expect(sql).toContain('"GameTagSource"."displayTier" IS DISTINCT FROM EXCLUDED."displayTier"')
  })

  it('aborts a fetched snapshot when the game VNDB ID changed meanwhile', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 12 }]),
      game: {
        findUnique: vi.fn().mockResolvedValue({ vndbId: 'v999', deletedAt: null }),
      },
      $executeRaw: vi.fn(),
    }

    await expect(syncVndbTagsForGameInTransaction(tx as never, {
      gameId: 12,
      tags: [],
      expectedVndbId: 'v123',
    })).rejects.toThrow('VNDB ID 已在同步期间发生变化')
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('accepts a cleared VNDB ID when both expected and stored values are null', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 12 }]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      game: {
        findUnique: vi.fn().mockResolvedValue({ vndbId: null, deletedAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      gameVndbTag: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      vndbTag: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    const result = await syncVndbTagsForGameInTransaction(tx as never, {
      gameId: 12,
      tags: [],
      expectedVndbId: null,
    })

    expect(result.rawTagCount).toBe(0)
    expect(tx.gameVndbTag.deleteMany).toHaveBeenCalledWith({ where: { gameId: 12 } })
  })
})

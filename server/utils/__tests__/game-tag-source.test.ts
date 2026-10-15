import { GameTagSourceType } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  lockExistingGameTagStatesInTransaction,
  lockGameTagStatesInTransaction,
  ManualGameTagUnavailableError,
  normalizeTagIds,
  planGameTagSourceReplacement,
  replaceGameTagSourceInTransaction,
} from '../game-tag-source'

describe('game tag source planning', () => {
  it('normalizes IDs deterministically and drops invalid values', () => {
    expect(normalizeTagIds([7, 2, 7, 0, -1, 1.5, Number.NaN, 3])).toEqual([2, 3, 7])
  })

  it('plans source-specific additions and removals', () => {
    expect(planGameTagSourceReplacement([1, 2, 4], [2, 3, 4, 3])).toEqual({
      targetTagIds: [2, 3, 4],
      addedTagIds: [3],
      removedTagIds: [1],
      unchangedTagIds: [2, 4],
    })
  })

  it('handles replacing a source with an empty set', () => {
    expect(planGameTagSourceReplacement([9, 8], [])).toEqual({
      targetTagIds: [],
      addedTagIds: [],
      removedTagIds: [8, 9],
      unchangedTagIds: [],
    })
  })
})

describe('game tag source transaction', () => {
  it('supports tolerant locks for purge paths while strict locks reject missing games', async () => {
    const tx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ id: 2 }])
        .mockResolvedValueOnce([{ id: 2 }]),
    }

    await expect(lockExistingGameTagStatesInTransaction(tx as never, [3, 2, 3]))
      .resolves.toEqual([2])
    await expect(lockGameTagStatesInTransaction(tx as never, [2, 3]))
      .rejects.toThrow('Game 3 does not exist')
  })

  it('replaces only the requested source and removes display rows only when orphaned', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 12 }]),
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([{ tagId: 1 }, { tagId: 2 }]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      tag: {
        findMany: vi.fn().mockResolvedValue([
          { id: 3, name: '新增标签', isSystem: false, archivedAt: null },
        ]),
      },
      gameTag: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }

    const result = await replaceGameTagSourceInTransaction(tx as never, {
      gameId: 12,
      source: GameTagSourceType.MANUAL,
      tagIds: [2, 3],
    })

    expect(result).toMatchObject({ addedTagIds: [3], removedTagIds: [1] })
    expect(tx.gameTagSource.deleteMany).toHaveBeenCalledWith({
      where: {
        gameId: 12,
        source: GameTagSourceType.MANUAL,
        tagId: { in: [1] },
      },
    })
    expect(tx.gameTag.deleteMany).toHaveBeenCalledWith({
      where: {
        gameId: 12,
        tagId: { in: [1] },
        sources: { none: {} },
      },
    })
  })

  it('does not acquire the game lock again when the caller already holds it', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      gameTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    }

    await replaceGameTagSourceInTransaction(tx as never, {
      gameId: 12,
      source: GameTagSourceType.VNDB,
      tagIds: [],
      alreadyLocked: true,
    })

    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })

  it('rejects adding archived or system tags as a manual source', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 12 }]),
      gameTagSource: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      gameTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      tag: {
        findMany: vi.fn().mockResolvedValue([
          { id: 9, name: '系统标签', isSystem: true, archivedAt: null },
        ]),
      },
    }

    await expect(replaceGameTagSourceInTransaction(tx as never, {
      gameId: 12,
      source: GameTagSourceType.MANUAL,
      tagIds: [9],
    })).rejects.toBeInstanceOf(ManualGameTagUnavailableError)
    expect(tx.gameTag.createMany).not.toHaveBeenCalled()
  })
})

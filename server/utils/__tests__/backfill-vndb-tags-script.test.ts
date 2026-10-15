import { describe, expect, it } from 'vitest'
import {
  advanceCursorPagination,
  BACKFILL_CACHE_PATTERNS,
  CACHE_DELETE_BATCH_SIZE,
  DEFAULT_BATCH_SIZE,
  DEFAULT_INTERVAL_MS,
  deleteBackfillCacheKeys,
  getNextCursorPageRequest,
  MAX_BATCH_SIZE,
  parseCliOptions,
  type CursorPaginationState,
} from '../../../scripts/backfill-vndb-tags'

describe('VNDB tag backfill CLI options', () => {
  it('uses production-safe paging and request interval defaults', () => {
    expect(parseCliOptions([])).toEqual({
      apply: false,
      force: false,
      help: false,
      batchSize: DEFAULT_BATCH_SIZE,
      intervalMs: DEFAULT_INTERVAL_MS,
    })
    expect(DEFAULT_BATCH_SIZE).toBe(50)
  })

  it('parses batch, cursor, total limit, and write options', () => {
    expect(parseCliOptions([
      '--apply',
      '--force',
      '--batch-size=25',
      '--after-id',
      '800',
      '--limit=120',
      '--interval-ms',
      '2000',
    ])).toEqual({
      apply: true,
      force: true,
      help: false,
      batchSize: 25,
      afterId: 800,
      limit: 120,
      intervalMs: 2000,
    })
  })

  it('rejects unsafe batch sizes and ambiguous target options', () => {
    expect(() => parseCliOptions(['--batch-size', '0'])).toThrow('--batch-size 必须是正整数')
    expect(() => parseCliOptions(['--batch-size', String(MAX_BATCH_SIZE + 1)]))
      .toThrow(`--batch-size 不能大于 ${MAX_BATCH_SIZE}`)
    expect(() => parseCliOptions(['--after-id', '0'])).toThrow('--after-id 必须是正整数')
    expect(() => parseCliOptions(['--game-id', '12', '--after-id', '10']))
      .toThrow('--game-id 不能与 --after-id 同时使用')
  })
})

describe('VNDB tag backfill cache invalidation', () => {
  it('scans every affected prefix and deletes keys in bounded batches', async () => {
    const scans: Array<{ MATCH: string; COUNT: number }> = []
    const deletedBatches: string[][] = []

    const deletedCount = await deleteBackfillCacheKeys({
      scanIterator(options) {
        scans.push(options)
        const count = options.MATCH === 'home:*' ? CACHE_DELETE_BATCH_SIZE + 1 : 1
        return (async function* generateKeys() {
          for (let index = 0; index < count; index++) {
            yield `${options.MATCH.slice(0, -1)}${index}`
          }
        })()
      },
      async del(keys) {
        deletedBatches.push([...keys])
        return keys.length
      },
    })

    expect(scans).toEqual(BACKFILL_CACHE_PATTERNS.map(MATCH => ({
      MATCH,
      COUNT: CACHE_DELETE_BATCH_SIZE,
    })))
    expect(deletedBatches.map(keys => keys.length)).toEqual([
      CACHE_DELETE_BATCH_SIZE,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
    ])
    expect(deletedCount).toBe(CACHE_DELETE_BATCH_SIZE + BACKFILL_CACHE_PATTERNS.length)
  })

  it('propagates deletion failures instead of reporting stale caches as cleared', async () => {
    await expect(deleteBackfillCacheKeys({
      scanIterator() {
        return (async function* generateKey() {
          yield 'home:sfw'
        })()
      },
      async del() {
        throw new Error('redis unavailable')
      },
    })).rejects.toThrow('redis unavailable')
  })
})

describe('VNDB tag backfill cursor pagination', () => {
  it('advances an exclusive primary-key cursor across non-contiguous IDs', () => {
    const initial: CursorPaginationState = { afterId: 10, processed: 0 }
    expect(getNextCursorPageRequest(initial, { batchSize: 50 })).toEqual({
      afterId: 10,
      take: 50,
    })

    const advanced = advanceCursorPagination(initial, [12, 20, 35])
    expect(advanced).toEqual({ afterId: 35, processed: 3 })
    expect(getNextCursorPageRequest(advanced, { batchSize: 50 })).toEqual({
      afterId: 35,
      take: 50,
    })
  })

  it('applies limit once to the whole run rather than once per page', () => {
    const options = { batchSize: 50, limit: 120 }
    let state: CursorPaginationState = { processed: 0 }

    expect(getNextCursorPageRequest(state, options)).toEqual({ afterId: undefined, take: 50 })
    state = advanceCursorPagination(state, Array.from({ length: 50 }, (_, index) => index + 1))

    expect(getNextCursorPageRequest(state, options)).toEqual({ afterId: 50, take: 50 })
    state = advanceCursorPagination(state, Array.from({ length: 50 }, (_, index) => index + 51))

    expect(getNextCursorPageRequest(state, options)).toEqual({ afterId: 100, take: 20 })
    state = advanceCursorPagination(state, Array.from({ length: 20 }, (_, index) => index + 101))

    expect(state).toEqual({ afterId: 120, processed: 120 })
    expect(getNextCursorPageRequest(state, options)).toBeNull()
  })

  it('rejects repeated, out-of-order, and invalid page IDs', () => {
    const state: CursorPaginationState = { afterId: 10, processed: 5 }

    expect(() => advanceCursorPagination(state, [11, 11]))
      .toThrow('分页结果未按游戏 ID 严格递增')
    expect(() => advanceCursorPagination(state, [9]))
      .toThrow('分页结果未按游戏 ID 严格递增')
    expect(() => advanceCursorPagination({ processed: 0 }, [0]))
      .toThrow('分页结果包含无效游戏 ID')
  })
})

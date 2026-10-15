import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  setEx: vi.fn(),
  scanIterator: vi.fn(),
  del: vi.fn(),
}))
vi.mock('redis', () => ({
  createClient: () => ({
    isOpen: true,
    on: vi.fn(),
    connect: async () => {},
    get: async (key: string) => mocks.store.get(key) ?? null,
    setEx: mocks.setEx,
    scanIterator: mocks.scanIterator,
    del: mocks.del,
  }),
}))

import { cachedFetch, invalidateGameCaches } from '../redis'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.store.clear()
  vi.stubGlobal('useRuntimeConfig', () => ({ redisUrl: 'redis://test-only' }))
  mocks.setEx.mockImplementation(async (key, _ttl, value) => mocks.store.set(key, value))
  mocks.scanIterator.mockImplementation(async function* ({ MATCH }: { MATCH: string }) {
    const prefix = MATCH.replace(/\*$/, '')
    for (const key of mocks.store.keys()) if (key.startsWith(prefix)) yield key
  })
  mocks.del.mockImplementation(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) mocks.store.delete(key)
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('SearchGal integration with the existing cache', () => {
  it('invalidates every SearchGal scope and limit along with ordinary search caches', async () => {
    const sfwKey = 'search:integration:v1:["needle",12,false]'
    const nsfwKey = 'search:integration:v1:["needle",20,true]'
    const fetcher = vi.fn().mockResolvedValue({ items: [{ id: 1 }] })
    await cachedFetch(sfwKey, fetcher, 60)
    await cachedFetch(nsfwKey, fetcher, 60)
    await cachedFetch(sfwKey, fetcher, 60)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(mocks.setEx).toHaveBeenCalledWith(sfwKey, 60, JSON.stringify({ items: [{ id: 1 }] }))
    mocks.store.set('search:ordinary', '{}')
    mocks.store.set('ratelimit:integration:search:v1:searchgal', '12')
    await invalidateGameCaches(1)
    expect(mocks.store.has(sfwKey)).toBe(false)
    expect(mocks.store.has(nsfwKey)).toBe(false)
    expect(mocks.store.has('search:ordinary')).toBe(false)
    expect(mocks.store.get('ratelimit:integration:search:v1:searchgal')).toBe('12')
    fetcher.mockResolvedValue({ items: [] })
    expect(await cachedFetch(sfwKey, fetcher, 60)).toEqual({ items: [] })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('queries on every call without Redis; there is no in-memory result cache', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ redisUrl: '' }))
    const fetcher = vi.fn().mockResolvedValue({ items: [] })
    await cachedFetch('search:integration:v1:uncached', fetcher, 60)
    await cachedFetch('search:integration:v1:uncached', fetcher, 60)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(mocks.setEx).not.toHaveBeenCalled()
  })

  it('propagates database failures without storing an empty successful response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetcher = vi.fn().mockRejectedValue(new Error('database unavailable'))
    await expect(cachedFetch('search:integration:v1:error', fetcher, 60)).rejects.toThrow('database unavailable')
    expect(mocks.setEx).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

import { createError, createEvent, getHeader } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/integration/search.get'
import { requirePrivateApiKey } from '../private-api'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  rateLimit: vi.fn(),
  cache: vi.fn(),
}))
vi.mock('../prisma', () => ({ default: { $queryRaw: mocks.query } }))
vi.mock('../rate-limit', () => ({ isRateLimited: mocks.rateLimit }))
vi.mock('../redis', () => ({ cachedFetch: mocks.cache, getRedisClient: async () => null }))

const key = 'searchgal-test-only-'.repeat(3)
const privateKey = 'private-resource-test-only-'.repeat(3)
let config: { searchgalApiKey: unknown; privateApiKey: string; searchgalIncludeNsfw: unknown }
let cache: Map<string, unknown>

function event(query = 'q=needle', apiKey: string | undefined = key, cookie?: string) {
  const headers: Record<string, string> = {}
  const request = {
    url: `/api/integration/search?${query}`, method: 'GET',
    headers: { ...(apiKey === undefined ? {} : { 'x-api-key': apiKey }), cookie },
  }
  const response = {
    setHeader: vi.fn((name: string, value: string) => { headers[name.toLowerCase()] = value }),
    getHeader: (name: string) => headers[name.toLowerCase()],
  }
  return createEvent(request as never, response as never)
}

beforeEach(() => {
  vi.resetAllMocks()
  config = { searchgalApiKey: key, privateApiKey: privateKey, searchgalIncludeNsfw: false }
  cache = new Map()
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('getHeader', getHeader)
  vi.stubGlobal('createError', createError)
  mocks.rateLimit.mockResolvedValue(false)
  mocks.query.mockResolvedValue([])
  mocks.cache.mockImplementation(async (cacheKey: string, fetcher: () => Promise<unknown>) => {
    if (cache.has(cacheKey)) return cache.get(cacheKey)
    const result = await fetcher()
    cache.set(cacheKey, result)
    return result
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('SearchGal endpoint', () => {
  it('accepts the dedicated key, maps the display title, and exposes exactly the four fields', async () => {
    mocks.query.mockResolvedValue([{
      id: 123, titleZhHans: '千恋＊万花', titleZhHant: '千戀＊萬花', titleJa: '千恋', titleEn: 'Senren', isNsfw: true,
      url: 'sensitive-url', extractCode: 'secret', unzipPassword: 'secret', healthNote: 'internal', uploader: { id: 1 },
    }])
    const request = event()
    expect(await handler(request)).toEqual({ items: [{ id: 123, title: '千恋＊万花', path: '/games/123', isNsfw: true }] })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
    expect(mocks.rateLimit).toHaveBeenCalledWith(request, 'searchgal', {
      windowSeconds: 60, maxRequests: 120, keyPrefix: 'integration:search:v1',
    })
  })

  it.each(['wrong', '', privateKey])('rejects invalid key %s before rate limit and cache', async provided => {
    const request = event('q=needle', provided)
    await expect(handler(request)).rejects.toMatchObject({ statusCode: 401 })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.cache).not.toHaveBeenCalled()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('does not accept login cookies instead of the header', async () => {
    const request = event()
    delete request.node.req.headers['x-api-key']
    request.node.req.headers.cookie = 'auth-token=some-login-cookie'
    await expect(handler(request)).rejects.toMatchObject({ statusCode: 401 })
  })

  it.each(['', undefined, 'x'.repeat(31), '密'.repeat(10)])('fails closed for unconfigured or short keys: %s', async configured => {
    config.searchgalApiKey = configured
    await expect(handler(event('q=needle', configured))).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.cache).not.toHaveBeenCalled()
  })

  it('measures key strength in UTF-8 bytes', async () => {
    config.searchgalApiKey = '密'.repeat(11)
    expect(await handler(event('q=needle', config.searchgalApiKey as string))).toEqual({ items: [] })
  })

  it('does not authorize the full-resource API with the dedicated key', () => {
    expect(() => requirePrivateApiKey(event())).toThrowError(expect.objectContaining({ statusCode: 401 }))
    expect(() => requirePrivateApiKey(event('q=needle', privateKey))).not.toThrow()
  })

  it('authenticates and rate limits again on a populated cache', async () => {
    await handler(event())
    await handler(event())
    expect(mocks.query).toHaveBeenCalledTimes(1)
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2)
    await expect(handler(event('q=needle', 'wrong'))).rejects.toMatchObject({ statusCode: 401 })
    config.searchgalApiKey = ''
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.cache).toHaveBeenCalledTimes(2)
    config.searchgalApiKey = key
    mocks.rateLimit.mockResolvedValue(true)
    const request = event()
    await expect(handler(request)).rejects.toMatchObject({ statusCode: 429 })
    expect(request.node.res.getHeader('retry-after')).toBe(60)
    expect(mocks.cache).toHaveBeenCalledTimes(2)
  })

  it.each([false, 'false', 'FALSE', '', undefined, '0', 'yes'])('keeps NSFW off for %s', async value => {
    config.searchgalIncludeNsfw = value
    await handler(event())
    expect(mocks.query.mock.calls[0][0].values).toContain(false)
  })
  it.each([true, 'true', ' TRUE '])('enables NSFW for %s', async value => {
    config.searchgalIncludeNsfw = value
    await handler(event())
    expect(mocks.query.mock.calls[0][0].values).toContain(true)
  })

  it('keys the 60 second cache by trimmed query, limit and scope without delimiter ambiguity', async () => {
    await handler(event('q=%20needle%20'))
    await handler(event('q=needle&limit=12'))
    expect(mocks.query).toHaveBeenCalledTimes(1)
    expect(mocks.cache.mock.calls[0][0]).toBe('search:integration:v1:["needle",12,false]')
    expect(mocks.cache.mock.calls[0][2]).toBe(60)
    await handler(event('q=needle&limit=1'))
    config.searchgalIncludeNsfw = true
    await handler(event())
    await handler(event('q=' + encodeURIComponent('needle",12,false]:雪')))
    expect(cache.size).toBe(4)
  })

  it.each([
    '', 'q=', 'q=%20%20', `q=${'a'.repeat(101)}`, `q=${'😀'.repeat(101)}`, 'q=%00',
    'q=a&q=b', 'q=a&limit=0', 'q=a&limit=21', 'q=a&limit=-1', 'q=a&limit=1.5',
    'q=a&limit=1e1', 'q=a&limit=NaN', 'q=a&limit=', 'q=a&limit=2&limit=3',
    'q=a&page=2', 'q=a&sort=popular', 'q=a&includeNsfw=true', 'q=a&isNsfw=true',
  ])('rejects invalid parameters %s', async query => {
    await expect(handler(event(query))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.cache).not.toHaveBeenCalled()
  })

  it.each(['q=a&limit=1', 'q=a&limit=20', `q=${'😀'.repeat(100)}`, 'q=日本語', 'q=中文'])('accepts boundaries and Unicode: %s', async query => {
    await expect(handler(event(query))).resolves.toEqual({ items: [] })
  })

  it('uses the existing per-caller limiter for 120 requests, independent of IP', async () => {
    const { isRateLimited } = await vi.importActual<typeof import('../rate-limit')>('../rate-limit')
    const options = { keyPrefix: 'searchgal-test', windowSeconds: 60, maxRequests: 120 }
    for (let i = 0; i < 120; i++) expect(await isRateLimited(event(), 'searchgal', options)).toBe(false)
    expect(await isRateLimited(event(), 'searchgal', options)).toBe(true)
  })

  it('returns a sanitized 500 on database failure, without caching a successful empty response', async () => {
    mocks.query.mockRejectedValue(new Error('SELECT secret FROM internal; credentials and stack'))
    const request = event()
    await expect(handler(request)).rejects.toMatchObject({ statusCode: 500, message: '游戏搜索失败，请稍后再试' })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
    expect(cache.size).toBe(0)
  })
})

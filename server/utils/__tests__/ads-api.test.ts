import type { H3Event } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  invalidateAdsCache: vi.fn(),
}))

vi.mock('~/server/utils/auth', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('~/server/utils/prisma', () => ({ default: { advertisement: mocks } }))
vi.mock('~/server/utils/image', () => ({ markImageAsUsed: vi.fn(), markImageAsUnused: vi.fn() }))
vi.mock('~/server/utils/ad-cache', () => ({ invalidateAdsCache: mocks.invalidateAdsCache }))
vi.mock('~/server/utils/redis', () => ({
  cachedFetch: (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  CacheTTL: { SHORT: 60 },
}))

let createAd: typeof import('../../api/admin/ads.post').default
let updateAd: typeof import('../../api/admin/ads/[id].put').default
let getAds: typeof import('../../api/ads.get').default

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', (event: { body: unknown }) => event.body)
  vi.stubGlobal('getRouterParam', () => '1')
  vi.stubGlobal('getQuery', () => ({ slot: 'download_left' }))
  createAd = (await import('../../api/admin/ads.post')).default
  updateAd = (await import('../../api/admin/ads/[id].put')).default
  getAds = (await import('../../api/ads.get')).default
})

afterAll(() => vi.unstubAllGlobals())

const ad = {
  id: 1,
  name: '下载广告',
  slot: 'download_left',
  imageUrl: '/ad.png',
  linkUrl: 'https://example.com',
  showOnMobile: false,
}
const request = (body: object = {}) => ({ body }) as unknown as H3Event

beforeEach(() => {
  vi.resetAllMocks()
  mocks.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }))
  mocks.update.mockImplementation(({ data }) => Promise.resolve({ ...ad, ...data }))
  mocks.findUnique.mockResolvedValue(ad)
  mocks.findMany.mockResolvedValue([ad])
})

describe('advertisement mobile visibility', () => {
  it.each([true, false])('persists mobile visibility %s on creation', async showOnMobile => {
    const result = await createAd(request({ ...ad, showOnMobile }))
    expect(result.ad.showOnMobile).toBe(showOnMobile)
    expect(mocks.requireAdmin).toHaveBeenCalledOnce()
    expect(mocks.invalidateAdsCache).toHaveBeenCalledWith('download_left')
  })

  it('keeps older clients visible on mobile by default', async () => {
    const { showOnMobile: _showOnMobile, ...legacyAd } = ad
    const result = await createAd(request(legacyAd))
    expect(result.ad.showOnMobile).toBe(true)
  })

  it.each([true, false])('allows editing mobile visibility to %s', async showOnMobile => {
    const result = await updateAd(request({ showOnMobile }))
    expect(result.ad.showOnMobile).toBe(showOnMobile)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { showOnMobile } })
    expect(mocks.invalidateAdsCache).toHaveBeenCalledWith('download_left')
  })

  it('preserves mobile visibility when only enabling or disabling an ad', async () => {
    const result = await updateAd(request({ enabled: false }))
    expect(result.ad.showOnMobile).toBe(false)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { enabled: false } })
  })

  it('rejects string booleans without saving', async () => {
    await expect(updateAd(request({ showOnMobile: 'false' }))).rejects.toThrow()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns visibility to clients while sharing the same cached ads across devices', async () => {
    expect(await getAds(request())).toEqual([ad])
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { enabled: true, slot: 'download_left' },
      select: expect.objectContaining({ showOnMobile: true }),
    }))
  })
})

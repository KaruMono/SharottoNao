import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMoyuClient, MoyuApiError } from '../moyu-client'

function patchList() {
  return {
    object: 'list', next_cursor: null, total: null, missing: [],
    items: [{
      object: 'patch', id: '11617', vndb_id: 'v4145', catalog_work_id: '61311',
      content_limit: 'sfw', release_date: null, type: ['manual'], language: ['zh-Hans'], platform: ['windows'],
      resource_count: 1, download_count: 12, view_count: 4, favorite_count: 2, comment_count: 0,
      web_url: 'https://www.moyu.moe/patch/11617',
      created_at: '2025-11-02T09:14:33Z', updated_at: '2026-08-29T02:51:07Z', resource_updated_at: '2026-08-29T02:51:07Z',
      resources: [{
        object: 'patch_resource', id: '9007199254740993', patch_id: '11617', name: '汉化补丁',
        storage: 's3', size: '0.571 MB', hash: '', model_name: '', localization_group_name: '测试汉化组',
        note: '**说明**', type: ['manual'], language: ['zh-Hans'], platform: ['windows'],
        download_count: 12, like_count: 3,
        web_url: 'https://www.moyu.moe/resource/9007199254740993',
        created_at: '2025-11-02T09:14:33Z', updated_at: '2026-08-29T02:51:07Z',
        publisher: { object: 'user', id: '42', name: '发布者', avatar_url: '', web_url: 'https://www.moyu.moe/user/42' },
      }],
    }],
  }
}

afterEach(() => vi.useRealTimers())

describe('moyu v2 client', () => {
  it('looks up a VNDB anchor with a server credential and preserves distinct string IDs and web URLs', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(patchList()))
    const result = await createMoyuClient(' nmk_live_test ', request).findPatches(' V4145 ')
    const [url, options] = request.mock.calls[0]!
    expect(new URL(String(url)).origin).toBe('https://api.nextmoe.dev')
    expect(new URL(String(url)).pathname).toBe('/v2/moyu/patches')
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({
      refs: 'vndb:v4145', include: 'resources,publisher', nsfw: 'false',
    })
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer nmk_live_test')
    expect(result.items[0]).toMatchObject({ id: '11617', vndb_id: 'v4145', catalog_work_id: '61311' })
    expect(result.items[0]!.resources![0]).toMatchObject({
      id: '9007199254740993', size: '0.571 MB', download_count: 12,
      web_url: 'https://www.moyu.moe/resource/9007199254740993', publisher: { name: '发布者' },
    })
  })

  it('keeps unmatched anchors as a successful empty answer and caches it', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      object: 'list', items: [], next_cursor: null, total: null, missing: ['vndb:v4145'],
    }))
    const client = createMoyuClient('nmk_live_test', request)
    expect((await client.findPatches('v4145')).items).toEqual([])
    await client.findPatches('v4145')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('accepts unlinked catalog pages, empty resources and new vocabulary without dropping pages', async () => {
    const body = patchList()
    body.items.push({ ...body.items[0]!, id: '223309', resources: [], resource_count: 0 })
    const first = { ...body.items[0]!, catalog_work_id: null, content_limit: null }
    first.resources[0]!.type.push('future_kind')
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...body, items: [first, body.items[1]] }))
    const result = await createMoyuClient('nmk_live_test', request).findPatches('v4145')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.catalog_work_id).toBeNull()
    expect(result.items[0]!.resources![0]!.type).toContain('future_kind')
    expect(result.items[1]!.resources).toEqual([])
  })

  it('isolates NSFW cache entries and coalesces concurrent requests', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(patchList()))
    const client = createMoyuClient('nmk_live_test', request)
    await Promise.all([client.findPatches('v4145'), client.findPatches('v4145')])
    await client.findPatches('v4145', true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(new URL(String(request.mock.calls[1]![0])).searchParams.get('nsfw')).toBe('true')
  })

  it('revalidates expired data with the exact ETag and reuses the body on 304', async () => {
    vi.useFakeTimers()
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(patchList(), { headers: { ETag: '"moyu-v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
    const client = createMoyuClient('nmk_live_test', request)
    const original = await client.findPatches('v4145')
    vi.advanceTimersByTime(300_001)
    expect(await client.findPatches('v4145')).toEqual(original)
    await client.findPatches('v4145')
    expect(request).toHaveBeenCalledTimes(2)
    expect(new Headers(request.mock.calls[1]![1]?.headers).get('If-None-Match')).toBe('"moyu-v1"')
  })

  it.each(['RATE_LIMITED', 'QUOTA_EXCEEDED'] as const)('honors Retry-After for %s across games without immediate retries', async (code) => {
    vi.useFakeTimers()
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ code, detail: 'upstream details' }, { status: 429, headers: { 'Retry-After': '90' } }))
      .mockResolvedValueOnce(Response.json(patchList()))
    const client = createMoyuClient('nmk_live_test', request)
    await expect(client.findPatches('v4145')).rejects.toMatchObject({ code, statusCode: 429, retryAfter: 90 })
    vi.advanceTimersByTime(10_000)
    await expect(client.findPatches('v65869')).rejects.toMatchObject({ code, retryAfter: 80 })
    expect(request).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(80_001)
    await client.findPatches('v4145')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it.each([
    [401, 'INVALID_CREDENTIAL', 'CREDENTIAL_ERROR', 503],
    [404, 'NOT_FOUND', 'UPSTREAM_ERROR', 502],
    [503, 'SERVICE_UNAVAILABLE', 'UPSTREAM_ERROR', 502],
  ])('does not turn HTTP %s into an empty or cached result', async (status, upstreamCode, code, statusCode) => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({
      code: upstreamCode, detail: 'nmk_live_secret_should_not_leak',
    }, { status: status as number }))
    const client = createMoyuClient('nmk_live_test', request)
    await expect(client.findPatches('v4145')).rejects.toMatchObject({ code, statusCode, upstreamCode })
    await expect(client.findPatches('v4145')).rejects.not.toThrow('nmk_live_secret')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('fails gracefully without a key and never makes a request', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(createMoyuClient('', request).findPatches('v4145')).rejects.toMatchObject({ code: 'NOT_CONFIGURED', statusCode: 503 })
    expect(request).not.toHaveBeenCalled()
  })

  it.each([{}, { success: true, data: {} }, { ...patchList(), items: [{ ...patchList().items[0], resources: undefined }] }])(
    'rejects malformed and legacy responses', async body => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
      await expect(createMoyuClient('nmk_live_test', request).findPatches('v4145')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    },
  )

  it('strips fields outside the public contract and rejects executable resource URLs', async () => {
    const body = patchList()
    Object.assign(body.items[0]!.resources[0]!, { password: 'secret', code: '1234' })
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(body))
    const result = await createMoyuClient('nmk_live_test', request).findPatches('v4145')
    expect(result.items[0]!.resources![0]).not.toHaveProperty('password')
    expect(result.items[0]!.resources![0]).not.toHaveProperty('code')
    body.items[0]!.resources[0]!.web_url = 'javascript:alert(1)'
    request.mockResolvedValueOnce(Response.json(body))
    await expect(createMoyuClient('nmk_live_test', request).findPatches('v4145')).rejects.toBeInstanceOf(MoyuApiError)
  })

  it('handles timeouts without exposing raw request errors', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('sensitive request context', 'TimeoutError'))
    await expect(createMoyuClient('nmk_live_test', request).findPatches('v4145')).rejects.toMatchObject({ code: 'TIMEOUT', statusCode: 504 })
  })
})

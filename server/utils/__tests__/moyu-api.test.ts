import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/games/[id]/moyu-patches.get'
import { MoyuApiError } from '../moyu-client'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getAuthUser: vi.fn(),
  findPatches: vi.fn(),
  getMoyuClient: vi.fn(),
}))
vi.mock('../prisma', () => ({ default: { game: { findUnique: mocks.findUnique } } }))
vi.mock('../auth', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('../moyu-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../moyu-client')>(),
  getMoyuClient: mocks.getMoyuClient,
}))

function event(id = '42') {
  return {
    context: { params: { id } },
    node: { res: { setHeader: vi.fn() } },
  } as unknown as H3Event
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ nextmoeApiKey: 'nmk_live_server_only' }))
  mocks.findUnique.mockResolvedValue({ vndbId: 'v4145', isNsfw: false })
  mocks.getAuthUser.mockResolvedValue(null)
  mocks.getMoyuClient.mockReturnValue({ findPatches: mocks.findPatches })
  mocks.findPatches.mockResolvedValue({ object: 'list', items: [], next_cursor: null, total: null, missing: ['vndb:v4145'] })
})

describe('game moyu patches endpoint', () => {
  it('queries the game by local ID and the upstream by its VNDB anchor', async () => {
    const request = event()
    expect(await handler(request)).toEqual({ status: 'ok', patches: [] })
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 42, deletedAt: null }, select: { vndbId: true, isNsfw: true },
    })
    expect(mocks.findPatches).toHaveBeenCalledWith('v4145', false)
    expect(mocks.getMoyuClient).toHaveBeenCalledWith('nmk_live_server_only')
    expect(request.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
  })

  it.each(['', '0', '-1', '1.2', '42abc', '9007199254740992'])('rejects invalid local ID %s without querying', async id => {
    await expect(handler(event(id))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing or deleted game, before calling the upstream', async () => {
    mocks.findUnique.mockResolvedValue(null)
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.findPatches).not.toHaveBeenCalled()
  })

  it('distinguishes a missing VNDB association from no patches', async () => {
    mocks.findUnique.mockResolvedValue({ vndbId: null, isNsfw: false })
    await expect(handler(event())).resolves.toEqual({ status: 'missing_vndb', patches: [] })
    expect(mocks.findPatches).not.toHaveBeenCalled()
  })

  it.each([null, { nsfwMode: 'SFW' }])('enforces the existing NSFW access rule', async user => {
    mocks.findUnique.mockResolvedValue({ vndbId: 'v4145', isNsfw: true })
    mocks.getAuthUser.mockResolvedValue(user)
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.findPatches).not.toHaveBeenCalled()
  })

  it.each(['NSFW', 'ALL'])('includes adult patches for authorized %s users', async nsfwMode => {
    mocks.findUnique.mockResolvedValue({ vndbId: 'v4145', isNsfw: true })
    mocks.getAuthUser.mockResolvedValue({ nsfwMode })
    await handler(event())
    expect(mocks.findPatches).toHaveBeenCalledWith('v4145', true)
  })

  it('returns Retry-After and a distinct error instead of a successful empty response', async () => {
    const request = event()
    mocks.findPatches.mockRejectedValue(new MoyuApiError('QUOTA_EXCEEDED', 429, '请稍后重试', 120))
    await expect(handler(request)).rejects.toMatchObject({ statusCode: 429, data: { code: 'QUOTA_EXCEEDED', retryAfter: 120 } })
    expect(request.node.res.setHeader).toHaveBeenCalledWith('Retry-After', 120)
  })

  it('does not expose server credentials or upstream errors to the caller', async () => {
    mocks.findPatches.mockRejectedValue(new MoyuApiError('CREDENTIAL_ERROR', 503, '补丁服务暂不可用', undefined, 'INVALID_CREDENTIAL'))
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503, data: { code: 'CREDENTIAL_ERROR' } })
  })
})

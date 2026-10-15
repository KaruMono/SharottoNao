import { computed, effectScope, nextTick, onScopeDispose, ref, watch, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMoyuPatches } from '../../composables/useMoyuPatches'
import type { MoyuPatchesResponse } from '../../types/moyu'

const authFetch = vi.fn()
const token = ref<string | null>(null)
const session = ref<{ nsfwMode: string } | null>(null)
let scope: EffectScope

function setup() {
  const gameId = ref(1)
  const active = ref(false)
  scope = effectScope()
  const state = scope.run(() => useMoyuPatches(computed(() => gameId.value), computed(() => active.value)))!
  return { gameId, active, ...state }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  token.value = null
  session.value = null
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onScopeDispose', onScopeDispose)
  vi.stubGlobal('useAuthRequest', () => ({ authFetch }))
  vi.stubGlobal('useAuth', () => ({ token, data: session }))
})

afterEach(() => {
  scope?.stop()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('moyu patches loading state', () => {
  it('loads on demand and remembers an empty result across tab switches', async () => {
    authFetch.mockResolvedValue({ status: 'ok', patches: [] })
    const state = setup()
    expect(authFetch).not.toHaveBeenCalled()
    state.active.value = true
    await nextTick()
    await nextTick()
    expect(state.data.value).toEqual({ status: 'ok', patches: [] })
    state.active.value = false
    await nextTick()
    state.active.value = true
    await nextTick()
    expect(authFetch).toHaveBeenCalledTimes(1)
  })

  it('ignores an obsolete response when navigating to another game', async () => {
    let finishOld!: (result: MoyuPatchesResponse) => void
    authFetch
      .mockImplementationOnce(() => new Promise<MoyuPatchesResponse>(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce({ status: 'missing_vndb', patches: [] })
    const state = setup()
    state.active.value = true
    await nextTick()
    const firstSignal = authFetch.mock.calls[0]![1].signal as AbortSignal
    state.gameId.value = 2
    await nextTick()
    await nextTick()
    finishOld({ status: 'ok', patches: [] })
    await nextTick()
    expect(firstSignal.aborted).toBe(true)
    expect(state.data.value?.status).toBe('missing_vndb')
    expect(authFetch.mock.calls[1]![0]).toBe('/api/games/2/moyu-patches')
    expect(state.loading.value).toBe(false)
  })

  it('refreshes when content preferences change and clears on logout', async () => {
    authFetch.mockResolvedValue({ status: 'ok', patches: [] })
    const state = setup()
    state.active.value = true
    await nextTick()
    await nextTick()
    session.value = { nsfwMode: 'ALL' }
    await nextTick()
    await nextTick()
    expect(authFetch).toHaveBeenCalledTimes(2)
    state.active.value = false
    await nextTick()
    session.value = null
    expect(state.data.value).toBeNull()
  })

  it('shows failures separately from empty data and waits for Retry-After before retrying', async () => {
    authFetch
      .mockRejectedValueOnce({ data: { message: '请求过多', data: { retryAfter: 30 } } })
      .mockResolvedValueOnce({ status: 'ok', patches: [] })
    const state = setup()
    state.active.value = true
    await nextTick()
    await nextTick()
    expect(state.error.value).toBe('请求过多')
    expect(state.data.value).toBeNull()
    expect(state.retrySeconds.value).toBe(30)
    await state.reload()
    expect(authFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    await state.reload()
    expect(state.error.value).toBe('')
    expect(state.data.value).toEqual({ status: 'ok', patches: [] })
    expect(authFetch).toHaveBeenCalledTimes(2)
    expect(authFetch.mock.calls[0]![1].retry).toBe(0)
  })

  it('cancels in-flight requests when the page is disposed', async () => {
    authFetch.mockImplementation(() => new Promise(() => {}))
    const state = setup()
    state.active.value = true
    await nextTick()
    const signal = authFetch.mock.calls[0]![1].signal as AbortSignal
    scope.stop()
    expect(signal.aborted).toBe(true)
  })
})

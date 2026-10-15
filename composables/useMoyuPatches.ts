import { useNow } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import type { FetchError } from 'ofetch'
import type { MoyuPatchesResponse } from '~/types/moyu'

interface PatchErrorBody {
  message?: string
  data?: { retryAfter?: number }
}

export function useMoyuPatches(gameId: ComputedRef<number>, active: ComputedRef<boolean>) {
  const { authFetch } = useAuthRequest()
  const { token, data: session } = useAuth()
  const data = ref<MoyuPatchesResponse | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const retryAt = ref(0)
  const now = useNow({ interval: 1000 })
  const retrySeconds = computed(() => Math.max(0, Math.ceil((retryAt.value - now.value.getTime()) / 1000)))
  const resources = computed(() => data.value?.patches.flatMap(patch => patch.resources ?? []) ?? [])
  let controller: AbortController | undefined

  async function load() {
    if (loading.value || retryAt.value > Date.now()) return
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    try {
      const response = await authFetch<MoyuPatchesResponse>(`/api/games/${gameId.value}/moyu-patches`, {
        signal: current.signal,
        retry: 0,
        timeout: 15_000,
      })
      if (!current.signal.aborted) data.value = response
    } catch (cause) {
      if (current.signal.aborted) return
      const failure = cause as FetchError<PatchErrorBody>
      error.value = failure.data?.message || '补丁资源加载失败，请稍后重试'
      const seconds = failure.data?.data?.retryAfter
      retryAt.value = typeof seconds === 'number' && seconds > 0 ? Date.now() + seconds * 1000 : 0
    } finally {
      if (!current.signal.aborted) {
        loaded.value = true
        loading.value = false
      }
    }
  }

  // An in-flight response from a previous game/session must never populate this one.
  watch([gameId, token, () => session.value?.nsfwMode], () => {
    controller?.abort()
    data.value = null
    error.value = ''
    retryAt.value = 0
    loading.value = false
    loaded.value = false
    if (active.value) void load()
  }, { flush: 'sync' })

  watch(active, (enabled) => {
    if (enabled && !loaded.value) void load()
  }, { immediate: true })

  onScopeDispose(() => controller?.abort())

  return { data, resources, loading, error, retrySeconds, reload: load }
}

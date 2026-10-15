<template>
  <div class="border-t border-gray-200 pt-4 dark:border-zinc-700">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-sm font-medium">
          <Icon name="fa6-solid:tags" class="text-gray-400" aria-hidden="true" />
          <span>VNDB 标签</span>
          <code class="text-xs text-gray-500">{{ vndbId }}</code>
        </div>
        <p v-if="displayedSyncedAt" class="mt-1 text-xs text-gray-500">
          上次同步：{{ formatDate(displayedSyncedAt) }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          :disabled="loading || syncing"
          @click="loadPreview"
        >
          <Icon :name="loading ? 'fa6-solid:spinner' : 'fa6-solid:eye'" />
          预览
        </button>
        <button
          type="button"
          class="inline-flex min-h-9 items-center gap-2 rounded-lg bg-gray-800 px-3 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          :disabled="loading || syncing"
          @click="syncTags"
        >
          <Icon :name="syncing ? 'fa6-solid:spinner' : 'fa6-solid:arrows-rotate'" />
          立即同步
        </button>
      </div>
    </div>

    <div v-if="errorMessage" class="mt-3 text-sm text-red-500">
      <Icon name="fa6-solid:circle-exclamation" class="mr-1" aria-hidden="true" />{{ errorMessage }}
    </div>

    <div v-if="summary" class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <div v-for="metric in metrics" :key="metric.label" class="border-l-2 border-gray-200 pl-3 dark:border-zinc-600">
        <div class="text-lg font-semibold tabular-nums">{{ metric.value }}</div>
        <div class="text-xs text-gray-500">{{ metric.label }}</div>
      </div>
    </div>

    <label v-if="summary" class="mt-4 flex cursor-pointer items-start gap-2 text-sm">
      <input v-model="markGameNsfw" type="checkbox" class="mt-0.5 rounded" />
      <span>同步发现成人内容信号时，将游戏标记为 R18</span>
    </label>

    <div v-if="preview?.items.length" class="mt-4 max-h-72 overflow-auto border-y border-gray-200 dark:border-zinc-700">
      <div
        v-for="item in preview.items"
        :key="item.id"
        class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-gray-100 py-2 text-sm last:border-b-0 dark:border-zinc-700"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-medium">{{ item.nameEn }}</span>
            <code class="text-xs text-gray-400">{{ item.id }}</code>
            <span
              v-if="item.status === 'MAPPED'"
              class="text-xs font-medium"
              :class="item.displayTier === 'SECONDARY'
                ? 'text-gray-500 dark:text-zinc-400'
                : 'text-emerald-600 dark:text-emerald-400'"
            >{{ item.displayTier === 'SECONDARY' ? '副标签' : '主标签' }}</span>
            <span v-if="item.isNsfw" class="text-xs font-medium text-red-600 dark:text-red-400">R18</span>
          </div>
          <div class="mt-0.5 truncate text-xs text-gray-500">
            {{ item.tag?.name || statusLabel(item.status) }}
          </div>
        </div>
        <div class="text-right text-xs tabular-nums text-gray-500">
          <div>相关度 {{ item.rating.toFixed(1) }}</div>
          <div v-if="item.spoiler > 0" class="text-orange-600 dark:text-orange-400">剧透 {{ item.spoiler }}</div>
        </div>
      </div>
    </div>

    <div v-else-if="preview" class="mt-4 border-y border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-zinc-700">
      当前筛选条件下没有可预览的 VNDB 标签
    </div>

    <div v-if="preview && preview.summary.pending > 0" class="mt-3 text-right">
      <NuxtLink to="/admin/vndb-tags?status=PENDING" class="text-sm text-blue-600 hover:underline dark:text-blue-400">
        处理待映射标签
        <Icon name="fa6-solid:arrow-right" class="ml-1" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
type MappingStatus = 'PENDING' | 'MAPPED' | 'IGNORED'

interface PreviewItem {
  id: string
  nameEn: string
  rating: number
  spoiler: number
  status: MappingStatus
  displayTier: 'PRIMARY' | 'SECONDARY'
  isNsfw: boolean
  eligible: boolean
  tag: { id: number; name: string } | null
}

interface PreviewResponse {
  items: PreviewItem[]
  summary: { total: number; mapped: number; pending: number; ignored: number; eligible: number }
}

interface SyncResponse {
  rawTagCount: number
  appliedTagIds: number[]
  mappedAssociationCount: number
  pendingVndbTagIds: string[]
  ignoredVndbTagIds: string[]
  suggestsGameNsfw: boolean
  gameMarkedNsfw: boolean
  syncedAt: string
}

const props = defineProps<{
  gameId: number
  vndbId: string
  lastSyncedAt?: string | Date | null
}>()

const emit = defineEmits<{ synced: [value: SyncResponse] }>()
const { authFetch } = useAuthRequest()
const toast = useToast()
const preview = ref<PreviewResponse | null>(null)
const syncResult = ref<SyncResponse | null>(null)
const loading = ref(false)
const syncing = ref(false)
const markGameNsfw = ref(false)
const errorMessage = ref('')
const displayedSyncedAt = computed(() => syncResult.value?.syncedAt || props.lastSyncedAt)

const summary = computed(() => preview.value?.summary || (syncResult.value
  ? {
      total: syncResult.value.rawTagCount,
      mapped: syncResult.value.mappedAssociationCount,
      pending: syncResult.value.pendingVndbTagIds.length,
      ignored: syncResult.value.ignoredVndbTagIds.length,
      eligible: syncResult.value.appliedTagIds.length,
    }
  : null))

const metrics = computed(() => summary.value ? [
  { label: '原始标签', value: summary.value.total },
  { label: '已映射', value: summary.value.mapped },
  { label: '已应用', value: summary.value.eligible },
  { label: '待处理', value: summary.value.pending },
  { label: '已忽略', value: summary.value.ignored },
] : [])

async function loadPreview() {
  loading.value = true
  errorMessage.value = ''
  try {
    preview.value = await authFetch<PreviewResponse>(`/api/admin/games/${props.gameId}/vndb-tags/preview`)
  } catch (error: any) {
    errorMessage.value = getRequestErrorMessage(error, 'VNDB 标签预览失败')
  } finally {
    loading.value = false
  }
}

async function syncTags() {
  syncing.value = true
  errorMessage.value = ''
  try {
    const result: any = await (authFetch as any)(`/api/admin/games/${props.gameId}/vndb-tags/sync`, {
      method: 'POST',
      body: { markGameNsfw: markGameNsfw.value },
    })
    syncResult.value = result
    emit('synced', result)
    toast.success(`已同步 ${result.rawTagCount} 条 VNDB 标签，应用 ${result.appliedTagIds.length} 个中文标签`)
    await loadPreview()
  } catch (error: any) {
    errorMessage.value = getRequestErrorMessage(error, 'VNDB 标签同步失败')
    toast.error(errorMessage.value)
  } finally {
    syncing.value = false
  }
}

function formatDate(value: string | Date) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })
}

function getRequestErrorMessage(error: any, fallback: string) {
  return error?.data?.statusMessage
    || error?.statusMessage
    || error?.data?.message
    || error?.message
    || fallback
}

function statusLabel(status: MappingStatus) {
  return { PENDING: '待映射', MAPPED: '已映射', IGNORED: '已忽略' }[status]
}
</script>

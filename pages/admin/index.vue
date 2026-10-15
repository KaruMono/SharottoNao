<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">仪表盘</h1>

    <div v-if="stats" class="space-y-6">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink 
          to="/admin/games"
          class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Icon name="fa6-solid:gamepad" class="text-blue-500 text-xl" />
            </div>
            <div>
              <div class="text-2xl font-bold">{{ stats.stats.totalGames }}</div>
              <div class="text-sm text-gray-500">游戏条目</div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink 
          to="/admin/users"
          class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <Icon name="fa6-solid:users" class="text-green-500 text-xl" />
            </div>
            <div class="min-w-0">
              <div class="text-2xl font-bold">{{ stats.stats.totalUsers }}</div>
              <div class="text-sm text-gray-500">注册用户</div>
              <div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] md:text-xs">
                <span class="text-green-600 dark:text-green-400 whitespace-nowrap">今日 +{{ stats.stats.todayUsers }}</span>
                <span class="text-gray-400 whitespace-nowrap">昨日 +{{ stats.stats.yesterdayUsers }}</span>
                <span class="text-blue-500 whitespace-nowrap">本月 +{{ stats.stats.monthUsers }}</span>
              </div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink 
          to="/admin/companies"
          class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Icon name="fa6-solid:building" class="text-purple-500 text-xl" />
            </div>
            <div>
              <div class="text-2xl font-bold">{{ stats.stats.totalCompanies }}</div>
              <div class="text-sm text-gray-500">会社</div>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink 
          to="/admin/images"
          class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Icon name="fa6-solid:image" class="text-orange-500 text-xl" />
            </div>
            <div>
              <div class="text-2xl font-bold">{{ stats.stats.totalImages }}</div>
              <div class="text-sm text-gray-500">图片</div>
              <div v-if="stats.stats.unusedImages > 0" class="text-xs text-orange-500">
                {{ stats.stats.unusedImages }} 张未使用
              </div>
            </div>
          </div>
        </NuxtLink>

        <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <Icon name="fa6-solid:download" class="text-cyan-500 text-xl" />
            </div>
            <div>
              <div class="text-2xl font-bold">{{ stats.stats.todayDownloads }}</div>
              <div class="text-sm text-gray-500">今日下载</div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Icon name="fa6-solid:right-to-bracket" class="text-indigo-500 text-xl" />
            </div>
            <div>
              <div class="text-2xl font-bold">{{ stats.stats.todayLogins }}</div>
              <div class="text-sm text-gray-500">今日登录</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷创建游戏条目 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <h3 class="font-semibold mb-3">快捷创建游戏条目</h3>
        <div class="flex gap-3">
          <input
            v-model="vndbIds"
            type="text"
            placeholder="输入 VNDB ID，多个用逗号或空格分隔（如：v12345, v67890）"
            class="admin-input flex-1"
            @keydown.enter="quickImport"
          />
          <AdminKumoButton
            @click="quickImport"
            :disabled="!vndbIds.trim() || quickImporting"
            variant="emphasis"
          >
            <Icon name="fa6-solid:spinner" class="animate-spin" v-if="quickImporting" />
            {{ quickImporting ? '导入中...' : '快速导入' }}
          </AdminKumoButton>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          输入 VNDB ID 后获取数据并创建条目，多个 ID 会按每批 20 个连续导入；缺少简介会用“-”占位，缺少封面会使用默认封面图
        </p>
        
        <!-- 导入进度 -->
        <div v-if="quickImporting && quickProgress.total > 0" class="mt-3">
          <div class="flex items-center justify-between text-sm mb-1">
            <span>正在处理... ({{ quickProgress.current }}/{{ quickProgress.total }})</span>
            <span v-if="quickProgress.failed > 0" class="text-red-500">{{ quickProgress.failed }} 个失败</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all" :style="{ width: (quickProgress.current / quickProgress.total * 100) + '%' }"></div>
          </div>
        </div>

        <!-- 导入结果 -->
        <div v-if="quickResult" class="mt-3 p-3 rounded-lg border dark:border-zinc-700">
          <div class="flex items-center gap-4 text-sm mb-2">
            <span class="text-green-600">成功: {{ quickResult.created }}</span>
            <span class="text-yellow-600">跳过: {{ quickResult.skipped }}</span>
            <span class="text-red-600">失败: {{ quickResult.failed }}</span>
          </div>
          <div v-if="quickResult.failedIds.length > 0" class="text-xs text-red-500">
            失败的 VNDB ID: {{ quickResult.failedIds.join(', ') }}
          </div>
          <div v-if="quickResult.skippedIds.length > 0" class="text-xs text-yellow-600 mt-1">
            跳过的 VNDB ID: {{ quickResult.skippedIds.join(', ') }}
          </div>
        </div>
      </div>

      <!-- VNDB 近期发售候选 -->
      <div v-if="isAdmin" class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div>
            <h3 class="font-semibold mb-1">近期发售候选</h3>
            <p class="text-xs text-gray-500">
              从 VNDB 获取未来 {{ upcomingDays }} 天内发售的候选条目；候选封面直接使用 VNDB 链接，只有点击上架后才会创建站内条目并保存封面。
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <AdminKumoButton
              @click="loadUpcomingReleases"
              :disabled="upcomingLoading || publishingUpcoming"
              variant="secondary"
            >
              <Icon name="fa6-solid:rotate-right" :class="{ 'animate-spin': upcomingLoading }" />
              {{ upcomingLoading ? '获取中...' : '获取候选' }}
            </AdminKumoButton>
            <AdminKumoButton
              @click="publishSelectedUpcoming"
              :disabled="selectedUpcomingIds.length === 0 || publishingUpcoming"
              variant="emphasis"
            >
              <Icon name="fa6-solid:spinner" class="animate-spin" v-if="publishingUpcoming" />
              {{ publishingUpcoming ? '上架中...' : `上架选中 ${selectedUpcomingIds.length}` }}
            </AdminKumoButton>
          </div>
        </div>

        <div v-if="upcomingResult" class="mb-3 p-3 rounded-lg border dark:border-zinc-700 text-sm">
          <div class="flex flex-wrap items-center gap-4">
            <span class="text-green-600">成功: {{ upcomingResult.created }}</span>
            <span class="text-yellow-600">跳过: {{ upcomingResult.skipped }}</span>
            <span class="text-red-600">失败: {{ upcomingResult.failed }}</span>
          </div>
          <div v-if="upcomingResult.failedIds.length > 0" class="text-xs text-red-500 mt-1">
            失败的 VNDB ID: {{ upcomingResult.failedIds.join(', ') }}
          </div>
          <div v-if="upcomingResult.skippedIds.length > 0" class="text-xs text-yellow-600 mt-1">
            跳过的 VNDB ID: {{ upcomingResult.skippedIds.join(', ') }}
          </div>
        </div>

        <div v-if="upcomingLoading" class="py-8 text-center text-sm text-gray-500">
          <Icon name="fa6-solid:spinner" class="fa-spin mr-1" />正在从 VNDB 获取候选...
        </div>
        <div v-else-if="upcomingFetched && upcomingCandidates.length === 0" class="py-8 text-center text-sm text-gray-500">
          {{ upcomingRangeLabel }} 暂无可展示的候选条目
        </div>
        <div v-else-if="upcomingCandidates.length > 0">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 text-xs text-gray-500">
            <label class="inline-flex items-center gap-2 select-none">
              <input
                v-model="allUpcomingSelected"
                type="checkbox"
                :disabled="availableUpcomingCandidates.length === 0 || publishingUpcoming"
                class="rounded border-gray-300"
              />
              <span>已选 {{ selectedUpcomingIds.length }} / 可上架 {{ availableUpcomingCandidates.length }}</span>
            </label>
            <span>{{ upcomingRangeLabel }}</span>
          </div>

          <div class="divide-y divide-gray-100 dark:divide-zinc-700 border border-gray-100 dark:border-zinc-700 rounded-lg overflow-hidden">
            <label
              v-for="candidate in upcomingCandidates"
              :key="candidate.vndbId"
              class="flex items-center gap-3 px-3 py-3 transition"
              :class="candidate.status === 'available'
                ? 'hover:bg-gray-50 dark:hover:bg-zinc-700/40 cursor-pointer'
                : 'bg-gray-50/70 dark:bg-zinc-900/30 opacity-75'"
            >
              <input
                v-model="selectedUpcomingIds"
                :value="candidate.vndbId"
                type="checkbox"
                :disabled="candidate.status !== 'available' || publishingUpcoming"
                class="rounded border-gray-300 flex-shrink-0"
              />
              <img
                v-if="candidate.coverImage"
                :src="candidate.coverImage"
                :alt="candidate.title"
                class="w-12 h-16 rounded object-cover bg-gray-100 dark:bg-zinc-700 flex-shrink-0"
                loading="lazy"
              />
              <div v-else class="w-12 h-16 rounded bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                <Icon name="fa6-solid:image" class="text-gray-400 text-sm" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm truncate">{{ candidate.title }}</div>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span>{{ candidate.vndbId }}</span>
                  <span v-if="candidate.developers.length">{{ candidate.developers.join(' / ') }}</span>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-sm tabular-nums">{{ candidate.releaseDate }}</div>
                <div
                  class="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs"
                  :class="getUpcomingStatusClass(candidate.status)"
                >
                  {{ getUpcomingStatusText(candidate.status) }}
                </div>
              </div>
            </label>
          </div>
        </div>
        <div v-else class="py-8 text-center text-sm text-gray-500">
          点击“获取候选”查看未来 {{ upcomingDays }} 天内发售、尚待人工确认上架的 VNDB 条目
        </div>
      </div>

      <!-- 最近数据 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 最近注册用户 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
          <h3 class="font-semibold mb-4">最近注册用户</h3>
          <div class="space-y-3">
            <div 
              v-for="user in stats.recentUsers" 
              :key="user.id"
              class="flex items-center justify-between text-sm"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                  <Icon name="fa6-solid:user" class="text-xs text-gray-400" />
                </div>
                <div>
                  <div class="font-medium">{{ user.username }}</div>
                  <div class="text-xs text-gray-500">{{ user.email }}</div>
                </div>
              </div>
              <span 
                class="px-2 py-0.5 text-xs rounded"
                :class="{
                  'bg-red-100 text-red-600': user.role === 'ADMIN',
                  'bg-blue-100 text-blue-600': user.role === 'EDITOR',
                  'bg-gray-100 text-gray-600': user.role === 'USER',
                }"
              >
                {{ user.role }}
              </span>
            </div>
          </div>
        </div>

        <!-- 最近创建条目 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
          <h3 class="font-semibold mb-4">最近创建条目</h3>
          <div class="space-y-3">
            <NuxtLink 
              v-for="game in stats.recentGames" 
              :key="game.id"
              :to="`/games/${game.id}`"
              class="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 -mx-2 px-2 py-1 rounded"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn }}</span>
                <span v-if="game.isNsfw" class="px-1 py-0.5 bg-red-500 text-white text-xs rounded">NSFW</span>
              </div>
              <span class="text-gray-500">{{ game.creator?.username }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  AdminStatsResponse,
  QuickImportResult,
  VndbUpcomingCandidate,
  VndbUpcomingCandidateStatus,
  VndbUpcomingPublishResult,
  VndbUpcomingResponse,
} from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { data: stats } = await useAuthFetch<AdminStatsResponse>('/api/admin/stats', { key: 'admin-stats' })
const { data: session } = useAuth()
const isAdmin = computed(() => (session.value as any)?.role === 'ADMIN')

const siteName = useSiteName()
useHead({
  title: computed(() => `管理后台 - ${siteName.value}`),
})

// 快捷导入功能
const vndbIds = ref('')
const quickImporting = ref(false)
const quickProgress = reactive({
  current: 0,
  total: 0,
  failed: 0,
})
const quickResult = ref<{
  created: number
  skipped: number
  failed: number
  failedIds: string[]
  skippedIds: string[]
} | null>(null)

const QUICK_IMPORT_BATCH_SIZE = 20

const { authFetch } = useAuthRequest()
const toast = useToast()

const upcomingDays = 14
const upcomingCandidates = ref<VndbUpcomingCandidate[]>([])
const selectedUpcomingIds = ref<string[]>([])
const upcomingLoading = ref(false)
const publishingUpcoming = ref(false)
const upcomingFetched = ref(false)
const upcomingRange = ref<{ startDate: string; endDate: string } | null>(null)
const upcomingResult = ref<VndbUpcomingPublishResult | null>(null)

const availableUpcomingCandidates = computed(() =>
  upcomingCandidates.value.filter(candidate => candidate.status === 'available')
)
const upcomingRangeLabel = computed(() => {
  if (!upcomingRange.value) return `未来 ${upcomingDays} 天`
  return `${upcomingRange.value.startDate} 至 ${upcomingRange.value.endDate}`
})
const allUpcomingSelected = computed({
  get() {
    return availableUpcomingCandidates.value.length > 0
      && availableUpcomingCandidates.value.every(candidate => selectedUpcomingIds.value.includes(candidate.vndbId))
  },
  set(checked: boolean) {
    selectedUpcomingIds.value = checked
      ? availableUpcomingCandidates.value.map(candidate => candidate.vndbId)
      : []
  },
})

function getUpcomingStatusText(status: VndbUpcomingCandidateStatus) {
  if (status === 'existing') return '已上架'
  if (status === 'deleted') return '已删除占用'
  return '可上架'
}

function getUpcomingStatusClass(status: VndbUpcomingCandidateStatus) {
  if (status === 'existing') return 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'
  if (status === 'deleted') return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
}

async function loadUpcomingReleases() {
  upcomingLoading.value = true
  upcomingResult.value = null

  try {
    const data = await authFetch<VndbUpcomingResponse>('/api/admin/vndb-upcoming', {
      query: { days: upcomingDays },
    })
    upcomingCandidates.value = data.candidates
    selectedUpcomingIds.value = []
    upcomingRange.value = {
      startDate: data.startDate,
      endDate: data.endDate,
    }
    upcomingFetched.value = true
  } catch (err: any) {
    toast.error(err.data?.message || err.message || '获取候选失败')
  } finally {
    upcomingLoading.value = false
  }
}

async function publishSelectedUpcoming() {
  const ids = [...selectedUpcomingIds.value]
  if (ids.length === 0 || publishingUpcoming.value) return

  publishingUpcoming.value = true

  try {
    const result = await authFetch<VndbUpcomingPublishResult>('/api/admin/vndb-upcoming-publish', {
      method: 'POST',
      body: { vndbIds: ids },
    })

    upcomingResult.value = result
    selectedUpcomingIds.value = []

    if (result.created > 0) {
      const createdIds = new Set(result.createdIds)
      upcomingCandidates.value = upcomingCandidates.value.map(candidate =>
        createdIds.has(candidate.vndbId)
          ? { ...candidate, status: 'existing' as const }
          : candidate
      )
      await refreshNuxtData()
    }

    if (result.failed > 0) {
      toast.warning(`上架完成：成功 ${result.created}，失败 ${result.failed}`)
    } else {
      toast.success(`上架完成：成功 ${result.created}，跳过 ${result.skipped}`)
    }
  } catch (err: any) {
    toast.error(err.data?.message || err.message || '上架失败')
  } finally {
    publishingUpcoming.value = false
  }
}

async function quickImport() {
  const input = vndbIds.value.trim()
  if (!input) return

  const ids = input
    .split(/[,，\s]+/)
    .map(id => id.trim().toLowerCase())
    .filter(id => id)
    .map(id => /^\d+$/.test(id) ? `v${id}` : id)
    .filter(id => /^v\d+$/.test(id))

  if (ids.length === 0) {
    alert('请输入有效的 VNDB ID')
    return
  }

  quickImporting.value = true
  quickProgress.current = 0
  quickProgress.total = ids.length
  quickProgress.failed = 0
  quickResult.value = null

  const result: QuickImportResult = {
    created: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    skippedIds: [],
  }

  try {
    for (let i = 0; i < ids.length; i += QUICK_IMPORT_BATCH_SIZE) {
      const batch = ids.slice(i, i + QUICK_IMPORT_BATCH_SIZE)
      const batchResult = await authFetch<QuickImportResult>('/api/admin/quick-import', {
        method: 'POST',
        body: { vndbIds: batch },
      })

      result.created += batchResult.created
      result.skipped += batchResult.skipped
      result.failed += batchResult.failed
      result.failedIds.push(...batchResult.failedIds)
      result.skippedIds.push(...batchResult.skippedIds)

      quickProgress.current += batch.length
      quickProgress.failed = result.failed
      quickResult.value = { ...result }
    }

    quickResult.value = result
    vndbIds.value = ''
    
    if (result.created > 0) {
      await refreshNuxtData()
    }
  } catch (err: any) {
    alert('导入失败: ' + (err.data?.message || err.message))
  } finally {
    quickImporting.value = false
  }
}
</script>

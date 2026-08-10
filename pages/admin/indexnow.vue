<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">IndexNow 管理</h1>

    <!-- API Key 设置 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <h2 class="font-semibold text-lg mb-4">API Key 设置</h2>
      
      <div v-if="!settings" class="space-y-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <i class="fa-solid fa-info-circle text-blue-500 mt-0.5"></i>
            <div class="flex-1 text-sm">
              <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">首次使用需要生成 API Key</p>
              <p class="text-blue-700 dark:text-blue-300">生成后，系统会自动创建 API Key 文件，用于向搜索引擎提交网站更新。</p>
            </div>
          </div>
        </div>
        <button
          @click="generateApiKey"
          :disabled="generating"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition"
        >
          <i v-if="generating" class="fa-solid fa-spinner fa-spin mr-1"></i>
          {{ generating ? '生成中...' : '生成 API Key' }}
        </button>
      </div>

      <div v-else class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium">API Key</label>
            <button
              @click="regenerateApiKey"
              class="px-2 py-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded text-xs transition"
            >
              <i class="fa-solid fa-rotate mr-1"></i>重新生成
            </button>
          </div>
          <div class="flex gap-2">
            <input
              :value="settings.apiKey"
              type="text"
              readonly
              class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm font-mono"
            />
            <button
              @click="copyApiKey"
              class="px-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-sm"
            >
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            API Key 文件地址: <code class="bg-gray-100 dark:bg-zinc-700 px-1 py-0.5 rounded">{{ siteUrl }}/{{ settings.apiKey }}.txt</code>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoSubmit"
            v-model="autoSubmissionEnabled"
            @change="updateAutoSubmission"
            class="rounded"
          />
          <label for="autoSubmit" class="text-sm">自动提交新增/更新的页面到 IndexNow</label>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">每日提交限制</label>
          <div class="flex items-center gap-3">
            <input
              v-model.number="dailyLimit"
              type="number"
              min="1"
              max="10000"
              class="w-32 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
            />
            <span class="text-sm text-gray-500">条/天</span>
            <button
              @click="updateDailyLimit"
              class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
            >
              保存
            </button>
          </div>
          <p class="text-xs text-gray-500">
            限制每天自动提交的 URL 数量，防止超出搜索引擎配额。今日已提交：{{ stats?.todayCount || 0 }} / {{ dailyLimit }}
          </p>
        </div>

      </div>
    </div>

    <!-- 手动提交 URL -->
    <div v-if="settings" class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <h2 class="font-semibold text-lg mb-4">手动提交 URL</h2>
      <div class="flex gap-3">
        <input
          v-model="manualUrl"
          type="text"
          placeholder="输入要提交的完整 URL"
          class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
          @keydown.enter="submitManualUrl"
        />
        <button
          @click="submitManualUrl"
          :disabled="!manualUrl.trim() || submitting"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 text-sm"
        >
          <i v-if="submitting" class="fa-solid fa-spinner fa-spin mr-1"></i>
          提交
        </button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div v-if="stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <div class="text-2xl font-bold text-green-600">{{ stats.successCount }}</div>
        <div class="text-sm text-gray-500">成功提交</div>
      </div>
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <div class="text-2xl font-bold text-red-600">{{ stats.failedCount }}</div>
        <div class="text-sm text-gray-500">提交失败</div>
      </div>
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <div class="text-2xl font-bold text-blue-600">{{ stats.todayCount }}</div>
        <div class="text-sm text-gray-500">今日提交</div>
      </div>
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow">
        <div class="text-2xl font-bold text-purple-600">{{ stats.totalCount }}</div>
        <div class="text-sm text-gray-500">总提交数</div>
      </div>
    </div>

    <!-- 提交历史 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold text-lg">提交历史</h2>
        <div class="flex gap-2">
          <select v-model="filterStatus" class="px-3 py-1.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm">
            <option value="">全部状态</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILED">失败</option>
          </select>
          <button
            @click="refreshSubmissions"
            class="px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 text-sm"
            title="刷新"
          >
            <i class="fa-solid fa-rotate"></i>
          </button>
          <button
            @click="clearSubmissions"
            :disabled="clearing || submissions.length === 0"
            class="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 text-sm transition"
            title="清空历史"
          >
            <i v-if="clearing" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <div class="space-y-2 max-h-[500px] overflow-y-auto">
        <div
          v-for="submission in filteredSubmissions"
          :key="submission.id"
          class="flex items-center gap-3 p-3 rounded-lg border dark:border-zinc-700 text-sm"
        >
          <i
            :class="{
              'fa-solid fa-circle-check text-green-500': submission.status === 'SUCCESS',
              'fa-solid fa-circle-xmark text-red-500': submission.status === 'FAILED',
            }"
          ></i>
          <div class="flex-1 min-w-0">
            <div class="truncate">{{ submission.url }}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              {{ formatDate(submission.submittedAt) }}
              <span class="mx-1">·</span>
              <span
                :class="{
                  'text-blue-500': submission.type === 'ADD',
                  'text-orange-500': submission.type === 'UPDATE',
                  'text-red-500': submission.type === 'DELETE',
                }"
              >
                {{ typeLabels[submission.type] }}
              </span>
              <span v-if="submission.errorMessage" class="mx-1">·</span>
              <span v-if="submission.errorMessage" class="text-red-500">{{ submission.errorMessage }}</span>
            </div>
          </div>
          <button
            v-if="submission.status === 'FAILED'"
            @click="resubmit(submission)"
            class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500"
          >
            重试
          </button>
        </div>

        <div v-if="filteredSubmissions.length === 0" class="text-center py-8 text-gray-400">
          暂无提交记录
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type {
  DeleteResult,
  IndexNowSettings,
  IndexNowStats,
  IndexNowSubmission,
} from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const siteName = useSiteName()
useHead({
  title: computed(() => `IndexNow 管理 - ${siteName.value}`),
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

// 状态
const settings = ref<IndexNowSettings | null>(null)
const stats = ref<IndexNowStats | null>(null)
const submissions = ref<IndexNowSubmission[]>([])
const generating = ref(false)
const submitting = ref(false)
const manualUrl = ref('')
const filterStatus = ref('')
const clearing = ref(false)
const autoSubmissionEnabled = ref(true)
const dailyLimit = ref(100)
const runtimeConfig = useRuntimeConfig()
const siteUrl = computed(() => ((runtimeConfig.public?.siteUrl as string) || '').replace(/\/+$/, ''))

const typeLabels: Record<string, string> = {
  ADD: '新增',
  UPDATE: '更新',
  DELETE: '删除',
}

const filteredSubmissions = computed(() => {
  if (!filterStatus.value) return submissions.value
  return submissions.value.filter(s => s.status === filterStatus.value)
})

// 加载数据
async function loadData() {
  try {
    const [settingsData, statsData, submissionsData] = await Promise.all([
      authFetch<IndexNowSettings | null>('/api/admin/indexnow/settings').catch(() => null),
      authFetch<IndexNowStats | null>('/api/admin/indexnow/stats').catch(() => null),
      authFetch<IndexNowSubmission[]>('/api/admin/indexnow/submissions').catch(() => []),
    ])
    
    console.log('加载的 settings 数据:', settingsData)
    
    settings.value = settingsData
    stats.value = statsData
    submissions.value = submissionsData || []
    
    if (settingsData) {
      autoSubmissionEnabled.value = settingsData.autoSubmissionEnabled
      dailyLimit.value = settingsData.dailyLimit || 100
    }
  } catch (err: any) {
    console.error('Failed to load IndexNow data:', err)
  }
}

// 生成 API Key
async function generateApiKey() {
  generating.value = true
  try {
    const result = await authFetch<IndexNowSettings>('/api/admin/indexnow/generate-key', {
      method: 'POST',
    })
    
    console.log('API Key 生成结果:', result)
    
    // 确保响应式更新
    settings.value = {
      apiKey: result.apiKey,
      autoSubmissionEnabled: result.autoSubmissionEnabled,
      dailyLimit: result.dailyLimit || 100,
    }
    autoSubmissionEnabled.value = result.autoSubmissionEnabled
    dailyLimit.value = result.dailyLimit || 100
    
    toast.success('API Key 生成成功！')
    
    // 重新加载完整数据以确保同步
    await loadData()
  } catch (err: any) {
    console.error('生成 API Key 失败:', err)
    toast.error('生成失败: ' + (err.data?.message || err.message))
  } finally {
    generating.value = false
  }
}

// 重新生成 API Key
async function regenerateApiKey() {
  if (!confirm('重新生成 API Key 将使旧的 Key 失效，确定继续吗？')) return
  await generateApiKey()
}

// 复制 API Key
function copyApiKey() {
  if (!settings.value) return
  navigator.clipboard.writeText(settings.value.apiKey)
  toast.success('已复制到剪贴板')
}

// 更新自动提交设置
async function updateAutoSubmission() {
  try {
    await authFetch('/api/admin/indexnow/settings', {
      method: 'PUT',
      body: { autoSubmissionEnabled: autoSubmissionEnabled.value },
    })
    toast.success('设置已更新')
  } catch (err: any) {
    toast.error('更新失败: ' + (err.data?.message || err.message))
    autoSubmissionEnabled.value = !autoSubmissionEnabled.value
  }
}

// 更新每日限制
async function updateDailyLimit() {
  if (dailyLimit.value < 1 || dailyLimit.value > 10000) {
    toast.error('每日限制必须在 1-10000 之间')
    return
  }
  
  try {
    await authFetch('/api/admin/indexnow/settings', {
      method: 'PUT',
      body: { dailyLimit: dailyLimit.value },
    })
    toast.success('每日限制已更新')
  } catch (err: any) {
    toast.error('更新失败: ' + (err.data?.message || err.message))
  }
}

// 手动提交 URL
async function submitManualUrl() {
  if (!manualUrl.value.trim()) return
  submitting.value = true
  try {
    await authFetch('/api/admin/indexnow/submit', {
      method: 'POST',
      body: { url: manualUrl.value.trim() },
    })
    toast.success('提交成功')
    manualUrl.value = ''
    await loadData()
  } catch (err: any) {
    toast.error('提交失败: ' + (err.data?.message || err.message))
  } finally {
    submitting.value = false
  }
}

// 重新提交失败的 URL
async function resubmit(submission: IndexNowSubmission) {
  try {
    await authFetch('/api/admin/indexnow/submit', {
      method: 'POST',
      body: { url: submission.url, type: submission.type },
    })
    toast.success('重新提交成功')
    await loadData()
  } catch (err: any) {
    toast.error('提交失败: ' + (err.data?.message || err.message))
  }
}

// 刷新提交历史
async function refreshSubmissions() {
  try {
    const data = await authFetch<IndexNowSubmission[]>('/api/admin/indexnow/submissions')
    submissions.value = data
  } catch (err: any) {
    toast.error('刷新失败: ' + (err.data?.message || err.message))
  }
}

// 清空提交历史
async function clearSubmissions() {
  if (!confirm('确定要清空所有提交历史记录吗？此操作不可撤销。')) return
  clearing.value = true
  try {
    const result = await authFetch<DeleteResult>('/api/admin/indexnow/submissions', { method: 'DELETE' })
    submissions.value = []
    await loadData()
    toast.success(`已清空 ${result.deleted} 条提交历史`)
  } catch (err: any) {
    toast.error('清空失败: ' + (err.data?.message || err.message))
  } finally {
    clearing.value = false
  }
}

// 初始化
onMounted(() => {
  loadData()
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold">系统错误日志</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">记录邮件发送等后台异常</p>
      </div>
      <AdminKumoButton variant="danger"
        @click="clearLogs"
        :disabled="clearing || !data?.items?.length"
      >
        <Icon name="fa6-solid:spinner" v-if="clearing" />
        <Icon name="fa6-solid:trash" v-else />
        清除日志
      </AdminKumoButton>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex flex-wrap items-center gap-3">
        <AdminSelect aria-label="类型"
          v-model="typeQuery"
          @change="handleSearch"
        >
          <option value="">全部类型</option>
          <option value="MAIL">邮件错误</option>
        </AdminSelect>
        <AdminKumoButton variant="secondary"
          @click="refreshLogs"
        >
          <Icon name="fa6-solid:rotate" />
          刷新
        </AdminKumoButton>
      </div>
    </div>

    <div class="space-y-3">
      <div
        v-for="log in data?.items"
        :key="log.id"
        class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow"
      >
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                {{ typeLabel(log.type) }}
              </span>
              <span v-if="log.source" class="text-xs text-gray-500 dark:text-gray-400">{{ log.source }}</span>
              <span class="text-xs text-gray-400">#{{ log.id }}</span>
            </div>
            <div class="font-medium text-gray-900 dark:text-gray-100 break-words">{{ log.message }}</div>
            <div v-if="formatMetadata(log.metadata)" class="mt-2 text-xs text-gray-500 dark:text-gray-400 break-words">
              {{ formatMetadata(log.metadata) }}
            </div>
          </div>
          <div class="text-xs text-gray-500 whitespace-nowrap">{{ formatDate(log.createdAt) }}</div>
        </div>

        <details v-if="log.detail" class="mt-3">
          <summary class="cursor-pointer text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">查看详情</summary>
          <pre class="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-zinc-900 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-72 overflow-auto">{{ log.detail }}</pre>
        </details>
      </div>
    </div>

    <div v-if="pending" class="text-center text-gray-500 py-12">加载中...</div>
    <div v-else-if="!data?.items?.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow text-center text-gray-500 py-12">
      暂无错误日志
    </div>

    <Pagination admin
      v-if="data && data.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="data.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import type { ListResponse, SystemErrorLogItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { authFetch } = useAuthRequest()
const { formatDate } = useFormatDate()

const currentPage = ref(parseInt(route.query.page as string) || 1)
const typeQuery = ref((route.query.type as string) || '')
const clearing = ref(false)

const { data, pending, refresh } = await useAuthFetch<ListResponse<SystemErrorLogItem>>('/api/admin/system-error-logs', {
  key: 'admin-system-error-logs',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    type: typeQuery.value || undefined,
  })),
})

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    MAIL: '邮件错误',
  }
  return labels[type] || type
}

function formatMetadata(metadata: unknown) {
  if (!metadata) return ''
  if (typeof metadata === 'string') return metadata

  try {
    return JSON.stringify(metadata)
  } catch {
    return String(metadata)
  }
}

function handleSearch() {
  currentPage.value = 1
  router.push({
    query: {
      ...(typeQuery.value && { type: typeQuery.value }),
    },
  })
}

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({ query: { ...route.query, page } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refreshLogs() {
  await refresh()
}

async function clearLogs() {
  if (!confirm('确定要清除所有系统错误日志吗？此操作不可撤销。')) return

  clearing.value = true
  try {
    const result = await authFetch<{ deleted: number }>('/api/admin/system-error-logs/clear', { method: 'POST' })
    currentPage.value = 1
    await refresh()
    await refreshNuxtData()
    toast.success(`已清除 ${result.deleted} 条错误日志`)
  } catch (error: any) {
    toast.error(error.data?.message || '清除失败')
  } finally {
    clearing.value = false
  }
}

watch(() => route.query, async () => {
  typeQuery.value = (route.query.type as string) || ''
  currentPage.value = parseInt(route.query.page as string) || 1
  await refresh()
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">管理员操作日志</h1>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex flex-wrap items-center gap-4">
        <input
          v-model="actionQuery"
          type="text"
          placeholder="筛选动作（模糊匹配）..."
          class="admin-input"
          @keyup.enter="handleSearch"
        />
        <AdminKumoButton variant="primary"
          @click="handleSearch"
        >
          查询
        </AdminKumoButton>
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium">时间</th>
            <th class="px-4 py-3 text-left text-sm font-medium">管理员</th>
            <th class="px-4 py-3 text-left text-sm font-medium">动作</th>
            <th class="px-4 py-3 text-left text-sm font-medium">目标</th>
            <th class="px-4 py-3 text-left text-sm font-medium">内容</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="log in data?.items" :key="log.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(log.createdAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center">
                  <img v-if="log.admin?.avatar" :src="log.admin.avatar" class="w-full h-full object-cover" />
                  <Icon name="fa6-solid:user" class="text-gray-400 text-xs" v-else />
                </div>
                <span class="text-sm">{{ log.admin?.username || '-' }}</span>
                <span class="text-xs text-gray-400">#{{ log.adminId }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm font-medium">{{ log.action }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">
              <span v-if="log.targetType">{{ log.targetType }}{{ log.targetId ? `#${log.targetId}` : '' }}</span>
              <span v-else>-</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
              <pre class="whitespace-pre-wrap break-words">{{ log.content }}</pre>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!data?.items?.length" class="text-center text-gray-500 py-12">暂无日志</div>
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
import type { ListResponse, OperationLogItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { formatDate } = useFormatDate()

const currentPage = ref(parseInt(route.query.page as string) || 1)
const actionQuery = ref(route.query.action as string || '')

const { data, refresh } = await useAuthFetch<ListResponse<OperationLogItem>>('/api/admin/operation-logs', {
  key: 'admin-operation-logs',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    action: actionQuery.value || undefined,
  })),
})

function handleSearch() {
  currentPage.value = 1
  router.push({
    query: {
      ...(actionQuery.value && { action: actionQuery.value }),
    },
  })
}

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({ query: { ...route.query, page } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => route.query, async () => {
  actionQuery.value = (route.query.action as string) || ''
  currentPage.value = parseInt(route.query.page as string) || 1
  await refresh()
})
</script>

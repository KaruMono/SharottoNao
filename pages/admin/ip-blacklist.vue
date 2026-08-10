<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">IP 黑名单</h1>

    <!-- 搜索 + 添加 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索 IP..."
          class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
          @keyup.enter="handleSearch"
        />
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
      </div>
      <button
        @click="openAddModal"
        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
      >
        <i class="fa-solid fa-plus mr-2"></i>添加黑名单
      </button>
    </div>

    <!-- 列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium">IP 地址</th>
            <th class="px-4 py-3 text-left text-sm font-medium">原因</th>
            <th class="px-4 py-3 text-left text-sm font-medium">创建者</th>
            <th class="px-4 py-3 text-left text-sm font-medium">创建时间</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="item in listData?.items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3 font-mono text-sm">{{ item.ip }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ item.reason || '无' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ item.creator?.username || '未知' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(item.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                @click="removeIp(item.id, item.ip)"
                class="text-red-500 hover:text-red-600 text-sm"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!listData?.items?.length" class="text-center text-gray-500 py-12">
        暂无黑名单记录
      </div>
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="listData && listData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="listData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />

    <!-- 添加弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showAddModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showAddModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">添加 IP 黑名单</h3>
              <button @click="showAddModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form @submit.prevent="handleAdd" class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">IP 地址 *</label>
                <input
                  v-model="addForm.ip"
                  type="text"
                  placeholder="如：192.168.1.1"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">拉黑原因</label>
                <input
                  v-model="addForm.reason"
                  type="text"
                  placeholder="请输入原因"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" @click="showAddModal = false" class="px-4 py-2 rounded-lg border dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700">取消</button>
                <button type="submit" :disabled="addLoading" class="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50">
                  {{ addLoading ? '添加中...' : '确认添加' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { IpBlacklistItem, ListResponse } from '~/types/api'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()
const route = useRoute()
const router = useRouter()

const searchQuery = ref(route.query.search as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const showAddModal = ref(false)
const addLoading = ref(false)
const addForm = reactive({ ip: '', reason: '' })

const { data: listData, refresh } = await useAuthFetch<ListResponse<IpBlacklistItem>>('/api/admin/ip-blacklist', {
  key: 'admin-ip-blacklist',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    search: searchQuery.value || undefined,
  })),
})

function openAddModal() {
  addForm.ip = ''
  addForm.reason = ''
  showAddModal.value = true
}

async function handleAdd() {
  if (!addForm.ip.trim()) return
  addLoading.value = true
  try {
    await authFetch('/api/admin/ip-blacklist', {
      method: 'POST',
      body: { ip: addForm.ip.trim(), reason: addForm.reason.trim() || undefined },
    })
    await refresh()
    showAddModal.value = false
    toast.success('已添加 IP 黑名单')
  } catch (e: any) {
    toast.error(e.data?.message || '添加失败')
  } finally {
    addLoading.value = false
  }
}

async function removeIp(id: number, ip: string) {
  if (!confirm(`确定要将 ${ip} 从黑名单移除吗？`)) return
  try {
    await authFetch(`/api/admin/ip-blacklist/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('已移除')
  } catch (e: any) {
    toast.error(e.data?.message || '移除失败')
  }
}

function handleSearch() {
  currentPage.value = 1
  router.push({ query: { ...(searchQuery.value && { search: searchQuery.value }) } })
}

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({ query: { ...(searchQuery.value && { search: searchQuery.value }), ...(page > 1 && { page }) } })
}

useHead({ title: 'IP 黑名单 - 管理后台' })
</script>
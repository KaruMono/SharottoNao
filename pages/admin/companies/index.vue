<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">会社管理</h1>
      <NuxtLink 
        to="/admin/companies/create"
        class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 transition flex items-center gap-1.5"
      >
        <i class="fa-solid fa-plus"></i>添加会社
      </NuxtLink>
    </div>

    <!-- 搜索 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="relative max-w-md">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索会社..." 
          class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
          @keyup.enter="handleSearch"
        />
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
      </div>
    </div>

    <div v-if="selectedIds.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex items-center justify-between">
      <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 个会社</span>
      <button
        @click="batchDelete"
        class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
      >
        <i class="fa-solid fa-trash mr-1"></i>批量删除
      </button>
    </div>

    <!-- 会社列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th class="px-4 py-3 text-left text-sm font-medium">成立年份</th>
            <th class="px-4 py-3 text-left text-sm font-medium">作品数</th>
            <th class="px-4 py-3 text-left text-sm font-medium">创建者</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="company in companiesData?.items" :key="company.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.includes(company.id)" @change="toggleSelect(company.id)" class="rounded" />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                  <img v-if="company.logo" :src="company.logo" class="w-full h-full object-cover" />
                  <i v-else class="fa-solid fa-building text-gray-400"></i>
                </div>
                <div>
                  <NuxtLink :to="`/companies/${company.id}`" class="font-medium hover:underline">
                    {{ company.name }}
                  </NuxtLink>
                  <div v-if="company.nameOriginal" class="text-xs text-gray-500">
                    {{ company.nameOriginal }}
                  </div>
                  <div v-if="company.parent" class="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <i class="fa-solid fa-sitemap text-[10px]"></i>
                    <NuxtLink :to="`/companies/${company.parent.id}`" class="hover:text-blue-500 hover:underline">
                      {{ company.parent.name }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ company.foundedYear || '-' }}
            </td>
            <td class="px-4 py-3 text-sm">
              {{ company.gamesCount }}
              <span v-if="company.childrenCount" class="ml-1.5 text-xs text-gray-400">
                ({{ company.childrenCount }} 家子会社)
              </span>
            </td>
            <td class="px-4 py-3 text-sm">{{ company.creator?.username }}</td>
            <td class="px-4 py-3 text-right space-x-3">
              <NuxtLink 
                :to="`/admin/companies/${company.id}/edit`"
                class="text-blue-500 hover:text-blue-600 text-sm"
              >
                编辑
              </NuxtLink>
              <button 
                @click="deleteCompany(company.id, company.name)"
                class="text-red-500 hover:text-red-600 text-sm"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!companiesData?.items?.length" class="text-center text-gray-500 py-12">
        暂无会社数据
      </div>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="companiesData && companiesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="companiesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import type { CompanyItem, ListResponse } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()

const searchQuery = ref(route.query.search as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const selectedIds = ref<number[]>([])

const { data: companiesData, refresh } = await useAuthFetch<ListResponse<CompanyItem>>('/api/admin/companies', {
  key: 'admin-companies-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    search: searchQuery.value || undefined,
  })),
})

function handleSearch() {
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
}

function updateUrl() {
  router.push({
    query: {
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

const pageItems = computed(() => companiesData.value?.items ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(company => selectedIds.value.includes(company.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(company => company.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

async function deleteCompany(id: number, name: string) {
  if (!confirm(`确定要删除会社「${name}」吗？`)) return
  
  try {
    await authFetch(`/api/admin/companies/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个会社吗？有关联游戏的会社会自动跳过。`)) return

  try {
    const result = await authFetch<{ deletedCount: number; failed: Array<{ name: string; reason: string }> }>('/api/admin/companies/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refresh()
    const failedText = result.failed.length ? `，${result.failed.length} 个跳过` : ''
    toast.success(`已删除 ${result.deletedCount} 个会社${failedText}`)
    showSkippedToast(result.failed)
  } catch (error: any) {
    toast.error(error.data?.message || '批量删除失败')
  }
}

function showSkippedToast(failed: Array<{ name: string; reason: string }>) {
  if (!failed.length) return
  const details = failed.slice(0, 5).map(item => `${item.name}（${item.reason}）`).join('、')
  const suffix = failed.length > 5 ? ` 等 ${failed.length} 个` : ''
  toast.warning(`已跳过：${details}${suffix}`, 7000)
}

watch(() => companiesData.value?.items, () => {
  selectedIds.value = []
})

const siteName = useSiteName()
useHead({
  title: computed(() => `会社管理 - ${siteName.value} 管理后台`),
})
</script>

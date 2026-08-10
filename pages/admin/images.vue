<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">图片管理</h1>
      <div class="flex gap-2">
        <button 
          @click="syncImages"
          :disabled="syncing"
          class="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          <i class="fa-solid fa-sync mr-1.5" :class="{ 'animate-spin': syncing }"></i>{{ syncing ? '同步中...' : '同步使用状态' }}
        </button>
        <button 
          @click="cleanupImages"
          :disabled="cleaning"
          class="px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-50"
        >
          <i class="fa-solid fa-trash mr-1.5"></i>{{ cleaning ? '清理中...' : '清理未使用图片' }}
        </button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex items-center justify-between gap-4">
        <select 
          v-model="unusedFilter"
          class="px-4 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          @change="handleFilter"
        >
          <option value="">全部图片</option>
          <option value="true">未使用</option>
          <option value="false">已使用</option>
        </select>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            全选当前页
          </label>
          <button
            v-if="selectedIds.length"
            @click="batchDelete"
            class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
          >
            <i class="fa-solid fa-trash mr-1"></i>删除所选 {{ selectedIds.length }}
          </button>
        </div>
      </div>
    </div>

    <!-- 图片列表 -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div 
        v-for="image in imagesData?.items" 
        :key="image.id"
        class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden group"
        :class="selectedIds.includes(image.id) ? 'ring-2 ring-gray-800 dark:ring-gray-300' : ''"
      >
        <div class="relative aspect-square">
          <label class="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-white/90 dark:bg-zinc-800/90 flex items-center justify-center shadow cursor-pointer">
            <input type="checkbox" :checked="selectedIds.includes(image.id)" @change="toggleSelect(image.id)" class="rounded" />
          </label>
          <img 
            :src="image.url" 
            :alt="image.originalName || ''"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <a 
              :href="image.url" 
              target="_blank"
              class="p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white"
            >
              <i class="fa-solid fa-magnifying-glass"></i>
            </a>
          </div>
          <div 
            v-if="!image.isUsed"
            class="absolute top-2 right-2 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded"
          >
            未使用
          </div>
        </div>
        <div class="p-2">
          <div class="text-xs text-gray-500 truncate">{{ image.originalName }}</div>
          <div class="text-xs text-gray-400">{{ formatSize(image.size) }}</div>
        </div>
      </div>
    </div>

    <div v-if="!imagesData?.items?.length" class="text-center text-gray-500 py-16">
      <i class="fa-solid fa-image text-4xl mb-4"></i>
      <p>暂无图片</p>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="imagesData && imagesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="imagesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import type { ImageItem, ListResponse } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()

const unusedFilter = ref(route.query.unused as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const cleaning = ref(false)
const syncing = ref(false)
const selectedIds = ref<number[]>([])

const { data: imagesData, refresh } = await useAuthFetch<ListResponse<ImageItem>>('/api/admin/images', {
  key: 'admin-images',
  query: computed(() => ({
    page: currentPage.value,
    limit: 24,
    unused: unusedFilter.value || undefined,
  })),
})

function handleFilter() {
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
      ...(unusedFilter.value && { unused: unusedFilter.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

const pageItems = computed(() => imagesData.value?.items ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(image => selectedIds.value.includes(image.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(image => image.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

async function cleanupImages() {
  if (!confirm('确定要清理所有未使用的图片吗？此操作不可撤销。')) return
  
  cleaning.value = true
  try {
    const result = await authFetch<{ message: string }>('/api/admin/images/cleanup', { method: 'POST' })
    toast.success(result.message)
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '清理失败')
  } finally {
    cleaning.value = false
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 张图片吗？已使用图片会自动跳过。`)) return

  cleaning.value = true
  try {
    const result = await authFetch<{ deletedCount: number; failed: Array<{ name: string; reason: string }> }>('/api/admin/images/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refresh()
    const failedText = result.failed.length ? `，${result.failed.length} 张跳过` : ''
    toast.success(`已删除 ${result.deletedCount} 张图片${failedText}`)
    showSkippedToast(result.failed)
  } catch (error: any) {
    toast.error(error.data?.message || '批量删除失败')
  } finally {
    cleaning.value = false
  }
}

function showSkippedToast(failed: Array<{ name: string; reason: string }>) {
  if (!failed.length) return
  const details = failed.slice(0, 5).map(item => `${item.name}（${item.reason}）`).join('、')
  const suffix = failed.length > 5 ? ` 等 ${failed.length} 张` : ''
  toast.warning(`已跳过：${details}${suffix}`, 7000)
}

watch(() => imagesData.value?.items, () => {
  selectedIds.value = []
})

async function syncImages() {
  syncing.value = true
  try {
    const result = await authFetch<{ message: string }>('/api/admin/images/sync', { method: 'POST' })
    toast.success(result.message)
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const siteName = useSiteName()
useHead({
  title: computed(() => `图片管理 - ${siteName.value} 管理后台`),
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">游戏系列管理</h1>
      <AdminKumoButton variant="primary"
        @click="showCreateModal = true"
      >
        <Icon name="fa6-solid:plus" />创建系列
      </AdminKumoButton>
    </div>

    <!-- 筛选 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="relative max-w-md">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索系列名称..." 
          class="admin-input w-full pl-10"
          @keyup.enter="handleSearch"
        />
        <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </div>

    <div v-if="selectedIds.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex items-center justify-between">
      <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 个系列</span>
      <AdminKumoButton variant="danger" size="toolbar"
        @click="batchDelete"
      >
        <Icon name="fa6-solid:trash" />批量删除
      </AdminKumoButton>
    </div>

    <!-- 系列列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">系列名称</th>
            <th class="px-4 py-3 text-left text-sm font-medium">NSFW</th>
            <th class="px-4 py-3 text-left text-sm font-medium">游戏数量</th>
            <th class="px-4 py-3 text-left text-sm font-medium">创建时间</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="series in seriesData?.items" :key="series.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.includes(series.id)" @change="toggleSelect(series.id)" class="rounded" />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img 
                  v-if="series.coverImage"
                  :src="series.coverImage" 
                  class="w-10 h-10 rounded object-cover"
                />
                <div v-else class="w-10 h-10 rounded bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                  <Icon name="fa6-solid:layer-group" class="text-gray-400" />
                </div>
                <div>
                  <div class="font-medium">{{ series.name }}</div>
                  <div v-if="series.nameOriginal" class="text-xs text-gray-500">{{ series.nameOriginal }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="series.isNsfw" class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded font-medium">NSFW</span>
              <span v-else class="text-gray-300 dark:text-zinc-600 text-sm">-</span>
            </td>
            <td class="px-4 py-3 text-sm">
              {{ series.gamesCount }} 个游戏
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ series.createdAt ? formatDate(series.createdAt) : '-' }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  @click="editSeries(series)"
                  class="text-blue-500 hover:text-blue-600 text-sm"
                >
                  编辑
                </button>
                <button 
                  @click="deleteSeries(series)"
                  class="text-red-500 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!seriesData?.items?.length" class="text-center text-gray-500 py-12">
        暂无游戏系列
      </div>
    </div>

    <!-- 分页 -->
    <Pagination admin
      v-if="seriesData && seriesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="seriesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />

    <!-- 创建/编辑弹窗 -->
    <Modal v-model="showCreateModal" :title="editingId ? '编辑系列' : '创建系列'">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">系列名称 *</label>
          <input 
            v-model="form.name"
            type="text"
            class="admin-input w-full"
            placeholder="输入系列名称"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">原名</label>
          <input 
            v-model="form.nameOriginal"
            type="text"
            class="admin-input w-full"
            placeholder="输入原名（可选）"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">简介</label>
          <textarea 
            v-model="form.description"
            rows="3"
            class="admin-textarea w-full"
            placeholder="输入系列简介（可选）"
          ></textarea>
        </div>
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              v-model="form.isNsfw"
              type="checkbox"
              class="w-4 h-4 rounded border-gray-300 text-gray-800 focus:ring-gray-400"
            />
            <span class="text-sm">标记为 NSFW</span>
          </label>
          <p class="text-xs text-gray-500 mt-1">SFW 模式下将不显示此系列</p>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <AdminKumoButton variant="secondary"
            @click="showCreateModal = false"
          >
            取消
          </AdminKumoButton>
          <AdminKumoButton variant="primary"
            @click="saveSeries"
            :disabled="!form.name || saving"
          >
            {{ saving ? '保存中...' : '保存' }}
          </AdminKumoButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { ListResponse, SeriesItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

const searchQuery = ref(route.query.search as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const showCreateModal = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const selectedIds = ref<number[]>([])

const form = reactive({
  name: '',
  nameOriginal: '',
  description: '',
  isNsfw: false,
})

const { data: seriesData, refresh } = await useAuthFetch<ListResponse<SeriesItem>>('/api/series', {
  key: 'admin-series',
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

const pageItems = computed(() => seriesData.value?.items ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(series => selectedIds.value.includes(series.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(series => series.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

function editSeries(series: SeriesItem) {
  editingId.value = series.id
  form.name = series.name
  form.nameOriginal = series.nameOriginal || ''
  form.description = series.description || ''
  form.isNsfw = series.isNsfw || false
  showCreateModal.value = true
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.nameOriginal = ''
  form.description = ''
  form.isNsfw = false
}

async function saveSeries() {
  if (!form.name) return
  
  saving.value = true
  try {
    if (editingId.value) {
      await authFetch(`/api/series/${editingId.value}`, {
        method: 'PUT',
        body: form,
      })
      toast.success('系列更新成功')
    } else {
      await authFetch('/api/series', {
        method: 'POST',
        body: form,
      })
      toast.success('系列创建成功')
    }
    showCreateModal.value = false
    resetForm()
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteSeries(series: SeriesItem) {
  if (!confirm(`确定要删除系列「${series.name}」吗？关联的游戏将取消系列关联。`)) return
  
  try {
    await authFetch(`/api/series/${series.id}`, { method: 'DELETE' })
    toast.success('删除成功')
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个系列吗？关联游戏将取消系列关联。`)) return

  try {
    const result = await authFetch<{ deletedCount: number }>('/api/admin/series/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refresh()
    toast.success(`已删除 ${result.deletedCount} 个系列`)
  } catch (error: any) {
    toast.error(error.data?.message || '批量删除失败')
  }
}

watch(() => seriesData.value?.items, () => {
  selectedIds.value = []
})

watch(showCreateModal, (val) => {
  if (!val) resetForm()
})

const siteName = useSiteName()
useHead({
  title: computed(() => `游戏系列管理 - ${siteName.value} 管理后台`),
})
</script>

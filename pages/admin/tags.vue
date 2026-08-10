<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">标签管理</h1>
      <button 
        @click="showAddModal = true"
        class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
      >
        <i class="fa-solid fa-plus mr-1.5"></i>添加标签
      </button>
    </div>

    <!-- 筛选 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="relative max-w-md">
        <input
          v-model="searchInput"
          type="text"
          placeholder="搜索标签名..."
          class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
          @input="onSearch"
        />
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
      </div>
    </div>

    <div v-if="selectedIds.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex items-center justify-between">
      <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 个标签</span>
      <button
        @click="batchDelete"
        class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
      >
        <i class="fa-solid fa-trash mr-1"></i>批量删除
      </button>
    </div>

    <!-- 标签列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">标签名</th>
            <th class="px-4 py-3 text-left text-sm font-medium">颜色</th>
            <th class="px-4 py-3 text-left text-sm font-medium">描述</th>
            <th class="px-4 py-3 text-left text-sm font-medium">NSFW</th>
            <th class="px-4 py-3 text-left text-sm font-medium">游戏数</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="tag in tagsData?.items" :key="tag.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.includes(tag.id)" @change="toggleSelect(tag.id)" class="rounded" />
            </td>
            <td class="px-4 py-3 font-medium">{{ tag.name }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <div 
                  class="w-6 h-6 rounded"
                  :style="{ backgroundColor: tag.color || '#6b7280' }"
                ></div>
                <span class="text-sm text-gray-500">{{ tag.color || '-' }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ tag.description || '-' }}</td>
            <td class="px-4 py-3">
              <span v-if="tag.isNsfw" class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded font-medium">NSFW</span>
              <span v-else class="text-gray-300 dark:text-zinc-600 text-sm">-</span>
            </td>
            <td class="px-4 py-3 text-sm">{{ tag.gamesCount }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  @click="editTag(tag)"
                  class="text-blue-500 hover:text-blue-600 text-sm"
                >
                  编辑
                </button>
                <button 
                  @click="deleteTag(tag.id, tag.name)"
                  class="text-red-500 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!tagsData?.items?.length" class="text-center text-gray-500 py-12">
        暂无标签
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="tagsData?.pagination && tagsData.pagination.totalPages > 1" class="flex items-center justify-between mt-4">
      <div class="text-sm text-gray-500 dark:text-gray-400">
        共 {{ tagsData.pagination.total }} 个标签，第 {{ tagsData.pagination.page }} / {{ tagsData.pagination.totalPages }} 页
      </div>
      <div class="flex items-center gap-1">
        <button
          :disabled="page <= 1"
          @click="page--"
          class="px-3 py-1.5 rounded-lg border dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <template v-for="p in paginationPages" :key="p">
          <span v-if="p === '...'" class="px-2 text-gray-400">…</span>
          <button
            v-else
            @click="page = p as number"
            class="px-3 py-1.5 rounded-lg border text-sm transition"
            :class="p === page
              ? 'bg-gray-800 dark:bg-zinc-600 text-white border-transparent'
              : 'dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700'"
          >
            {{ p }}
          </button>
        </template>
        <button
          :disabled="page >= (tagsData?.pagination?.totalPages ?? 1)"
          @click="page++"
          class="px-3 py-1.5 rounded-lg border dark:border-zinc-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
        >
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <Teleport to="body">
    <Transition name="modal">
    <div 
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md modal-content">
        <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
          <h3 class="font-semibold">{{ editingTag ? '编辑标签' : '添加标签' }}</h3>
          <button @click="closeModal" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">标签名 *</label>
            <input 
              v-model="form.name"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">颜色</label>
            <div class="flex items-center gap-2">
              <input 
                v-model="form.color"
                type="color" 
                class="w-10 h-10 rounded cursor-pointer"
              />
              <input 
                v-model="form.color"
                type="text" 
                class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                placeholder="#ec4899"
              />
              <button
                type="button"
                @click="randomColor"
                class="px-3 py-2 rounded-lg border dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition text-sm whitespace-nowrap"
                title="随机颜色"
              >
                <i class="fa-solid fa-dice"></i>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">描述</label>
            <textarea 
              v-model="form.description"
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              rows="2"
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
            <p class="text-xs text-gray-500 mt-1">SFW 模式下将不显示此标签</p>
          </div>
          
          <div class="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              @click="closeModal"
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm"
            >
              取消
            </button>
            <button 
              type="submit"
              :disabled="loading"
              class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm disabled:opacity-50"
            >
              {{ loading ? '保存中...' : '保存' }}
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
import type { ListResponse, TagItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()

const page = ref(1)
const searchInput = ref('')
const search = ref('')
const selectedIds = ref<number[]>([])

let searchTimer: ReturnType<typeof setTimeout>
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = searchInput.value
    page.value = 1
  }, 300)
}

const { data: tagsData, refresh } = await useAuthFetch<ListResponse<TagItem>>('/api/admin/tags', {
  key: 'admin-tags',
  query: computed(() => ({ page: page.value, search: search.value || undefined })),
  watch: [page, search],
})

const paginationPages = computed(() => {
  const total = tagsData.value?.pagination?.totalPages ?? 1
  const cur = page.value
  const pages: (number | string)[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (cur > 3) pages.push('...')
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
    if (cur < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

const pageItems = computed(() => tagsData.value?.items ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(tag => selectedIds.value.includes(tag.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(tag => tag.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

const showAddModal = ref(false)
const editingTag = ref<TagItem | null>(null)
const loading = ref(false)

const form = reactive({
  name: '',
  color: '#6b7280',
  description: '',
  isNsfw: false,
})

function editTag(tag: TagItem) {
  editingTag.value = tag
  form.name = tag.name
  form.color = tag.color || '#6b7280'
  form.description = tag.description || ''
  form.isNsfw = tag.isNsfw || false
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingTag.value = null
  form.name = ''
  form.color = '#6b7280'
  form.description = ''
  form.isNsfw = false
}

function randomColor() {
  const hue = Math.floor(Math.random() * 360)
  const saturation = 60 + Math.floor(Math.random() * 25)
  const lightness = 45 + Math.floor(Math.random() * 15)
  const h = hue / 360
  const s = saturation / 100
  const l = lightness / 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255)
  form.color = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

async function handleSubmit() {
  if (!form.name) return
  
  loading.value = true
  try {
    if (editingTag.value) {
      await authFetch(`/api/admin/tags/${editingTag.value.id}`, {
        method: 'PUT',
        body: form,
      })
    } else {
      await authFetch('/api/admin/tags', {
        method: 'POST',
        body: form,
      })
    }
    closeModal()
    await refresh()
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

async function deleteTag(id: number, name: string) {
  if (!confirm(`确定要删除标签「${name}」吗？`)) return
  
  try {
    await authFetch(`/api/admin/tags/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个标签吗？`)) return

  try {
    const result = await authFetch<{ deletedCount: number }>('/api/admin/tags/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refresh()
    toast.success(`已删除 ${result.deletedCount} 个标签`)
  } catch (error: any) {
    toast.error(error.data?.message || '批量删除失败')
  }
}

watch(() => tagsData.value?.items, () => {
  selectedIds.value = []
})

const siteName = useSiteName()
useHead({
  title: computed(() => `标签管理 - ${siteName.value} 管理后台`),
})
</script>

<style scoped>
</style>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">网盘类型管理</h1>
      <div class="flex items-center gap-2">
        <button
          @click="() => refreshResourceMatches()"
          :disabled="refreshingResources"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition disabled:opacity-50"
        >
          <i class="fa-solid fa-rotate mr-1.5" :class="{ 'fa-spin': refreshingResources }"></i>{{ refreshingResources ? '识别中...' : '刷新识别' }}
        </button>
        <button
          @click="showModal = true"
          class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
        >
          <i class="fa-solid fa-plus mr-1.5"></i>添加网盘
        </button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex items-center justify-between">
      <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 个网盘类型</span>
      <button
        @click="batchDelete"
        class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
      >
        <i class="fa-solid fa-trash mr-1"></i>批量删除
      </button>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">图标</th>
            <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th class="px-4 py-3 text-left text-sm font-medium">域名规则</th>
            <th class="px-4 py-3 text-left text-sm font-medium">排序</th>
            <th class="px-4 py-3 text-left text-sm font-medium">状态</th>
            <th class="px-4 py-3 text-left text-sm font-medium">资源数</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="item in netDisks || []" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" class="rounded" />
            </td>
            <td class="px-4 py-3">
              <i :class="item.icon || 'fa-solid fa-cloud'" class="text-xl"></i>
            </td>
            <td class="px-4 py-3 font-medium">{{ item.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 max-w-sm">
              <div class="flex flex-wrap gap-1">
                <span v-for="domain in item.domains" :key="domain" class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-xs">
                  {{ domain }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ item.sortOrder }}</td>
            <td class="px-4 py-3 text-sm">
              <span class="px-2 py-0.5 rounded text-xs" :class="item.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-zinc-700'">
                {{ item.isActive ? '启用' : '停用' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">{{ item.resourcesCount }}</td>
            <td class="px-4 py-3 text-right">
              <button @click="editItem(item)" class="text-blue-500 hover:text-blue-600 text-sm mr-3">编辑</button>
              <button @click="deleteItem(item)" class="text-red-500 hover:text-red-600 text-sm">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!netDisks?.length" class="text-center text-gray-500 py-12">暂无网盘类型</div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="closeModal">
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md modal-content">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">{{ editingItem ? '编辑网盘类型' : '添加网盘类型' }}</h3>
              <button @click="closeModal" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">名称 *</label>
                <input v-model="form.name" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：百度网盘" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">图标（FontAwesome类名）</label>
                <input v-model="form.icon" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如：fa-solid fa-cloud" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">域名规则 *</label>
                <textarea v-model="domainsText" rows="4" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="每行一个域名，如：&#10;pan.baidu.com&#10;quark.cn"></textarea>
                <p class="text-xs text-gray-500 mt-1">支持子域名后缀匹配，例如填 baidu.com 可匹配 pan.baidu.com。</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">排序</label>
                  <input v-model.number="form.sortOrder" type="number" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" />
                </div>
                <label class="flex items-center gap-2 pt-7 cursor-pointer">
                  <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300 dark:border-zinc-600" />
                  <span class="text-sm">启用识别</span>
                </label>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" @click="closeModal" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm">取消</button>
                <button type="submit" :disabled="loading" class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm disabled:opacity-50">
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
definePageMeta({ layout: 'admin', middleware: 'admin' })

type NetDiskItem = {
  id: number
  name: string
  icon?: string | null
  domains: string[]
  sortOrder: number
  isActive: boolean
  resourcesCount?: number
}

const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: netDisks, refresh } = await useAuthFetch<NetDiskItem[]>('/api/admin/net-disks', { key: 'admin-net-disks' })

const showModal = ref(false)
const editingItem = ref<NetDiskItem | null>(null)
const loading = ref(false)
const refreshingResources = ref(false)
const domainsText = ref('')
const form = reactive({ name: '', icon: '', sortOrder: 0, isActive: true })
const selectedIds = ref<number[]>([])

const pageItems = computed(() => netDisks.value ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(item => selectedIds.value.includes(item.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(item => item.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

function editItem(item: NetDiskItem) {
  editingItem.value = item
  form.name = item.name
  form.icon = item.icon || ''
  form.sortOrder = item.sortOrder
  form.isActive = item.isActive
  domainsText.value = item.domains.join('\n')
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingItem.value = null
  form.name = ''
  form.icon = ''
  form.sortOrder = 0
  form.isActive = true
  domainsText.value = ''
}

function parseDomains() {
  return domainsText.value.split(/[\n,，]/).map(item => item.trim()).filter(Boolean)
}

async function handleSubmit() {
  if (!form.name) return
  const body = { ...form, icon: form.icon || null, domains: parseDomains() }
  loading.value = true
  try {
    if (editingItem.value) {
      await authFetch(`/api/admin/net-disks/${editingItem.value.id}`, { method: 'PUT', body })
    } else {
      await authFetch('/api/admin/net-disks', { method: 'POST', body })
    }
    closeModal()
    await refreshResourceMatches(false)
    await refresh()
    toast.success('保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

async function deleteItem(item: NetDiskItem) {
  if (!confirm(`确定要删除网盘类型「${item.name}」吗？`)) return
  try {
    await authFetch(`/api/admin/net-disks/${item.id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个网盘类型吗？正在使用的类型会自动跳过。`)) return
  try {
    const result = await authFetch<{ deletedCount: number; failed: Array<{ name: string; reason: string }> }>('/api/admin/net-disks/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refreshResourceMatches(false)
    await refresh()
    const failedText = result.failed.length ? `，${result.failed.length} 个跳过` : ''
    toast.success(`已删除 ${result.deletedCount} 个网盘类型${failedText}`)
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

watch(() => netDisks.value, () => {
  selectedIds.value = []
})

async function refreshResourceMatches(showSuccess = true) {
  refreshingResources.value = true
  try {
    const result = await authFetch<{ scanned: number; updated: number }>('/api/admin/net-disks/refresh-resources', {
      method: 'POST',
    })
    await refresh()
    if (showSuccess) {
      toast.success(`已扫描 ${result.scanned} 个资源，更新 ${result.updated} 个匹配`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '刷新识别失败')
  } finally {
    refreshingResources.value = false
  }
}

const siteName = useSiteName()
useHead({ title: computed(() => `网盘类型管理 - ${siteName.value} 管理后台`) })
</script>

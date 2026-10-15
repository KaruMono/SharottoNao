<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">资源类型管理</h1>
      <AdminKumoButton variant="primary"
        @click="showAddModal = true"
      >
        <Icon name="fa6-solid:plus" />添加类型
      </AdminKumoButton>
    </div>

    <div v-if="selectedIds.length" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6 flex items-center justify-between">
      <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 个资源类型</span>
      <AdminKumoButton variant="danger" size="toolbar"
        @click="batchDelete"
      >
        <Icon name="fa6-solid:trash" />批量删除
      </AdminKumoButton>
    </div>

    <!-- 类型列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left w-10">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">图标</th>
            <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th class="px-4 py-3 text-left text-sm font-medium">排序</th>
            <th class="px-4 py-3 text-left text-sm font-medium">资源数</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="type in resourceTypes" :key="type.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input type="checkbox" :checked="selectedIds.includes(type.id)" @change="toggleSelect(type.id)" class="rounded" />
            </td>
            <td class="px-4 py-3">
              <FaIcon :icon="type.icon || 'fa6-solid:file'" class="text-xl" style="vertical-align: -0.15em" />
            </td>
            <td class="px-4 py-3 font-medium">{{ type.name }}</td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ type.sortOrder }}</td>
            <td class="px-4 py-3 text-sm">{{ type.resourcesCount }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  @click="editType(type)"
                  class="text-blue-500 hover:text-blue-600 text-sm"
                >
                  编辑
                </button>
                <button 
                  @click="deleteType(type.id, type.name)"
                  class="text-red-500 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!resourceTypes?.length" class="text-center text-gray-500 py-12">
        暂无资源类型
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
          <h3 class="font-semibold">{{ editingType ? '编辑资源类型' : '添加资源类型' }}</h3>
          <button @click="closeModal" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
            <Icon name="fa6-solid:xmark" />
          </button>
        </div>
        <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称 *</label>
            <input 
              v-model="form.name"
              type="text" 
              class="admin-input w-full"
              placeholder="如：Windows资源"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">图标（FontAwesome类名）</label>
            <input 
              v-model="form.icon"
              type="text" 
              class="admin-input w-full"
              placeholder="如：fa-brands fa-windows"
            />
            <p class="text-xs text-gray-500 mt-1">
              <a href="https://fontawesome.com/icons" target="_blank" class="hover:underline">
                查看所有图标 →
              </a>
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">排序</label>
            <input 
              v-model.number="form.sortOrder"
              type="number" 
              class="admin-input w-full"
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <AdminKumoButton variant="secondary"
              type="button"
              @click="closeModal"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="primary"
              type="submit"
              :disabled="loading"
            >
              {{ loading ? '保存中...' : '保存' }}
            </AdminKumoButton>
          </div>
        </form>
      </div>
    </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { ResourceTypeItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: resourceTypes, refresh } = await useAuthFetch<ResourceTypeItem[]>('/api/admin/resource-types', { key: 'admin-resource-types' })

const showAddModal = ref(false)
const editingType = ref<ResourceTypeItem | null>(null)
const loading = ref(false)
const selectedIds = ref<number[]>([])

const form = reactive({
  name: '',
  icon: '',
  sortOrder: 0,
})

const pageItems = computed(() => resourceTypes.value ?? [])
const allSelected = computed(() => pageItems.value.length > 0 && pageItems.value.every(type => selectedIds.value.includes(type.id)))

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : pageItems.value.map(type => type.id)
}

function toggleSelect(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

function editType(type: ResourceTypeItem) {
  editingType.value = type
  form.name = type.name
  form.icon = type.icon || ''
  form.sortOrder = type.sortOrder
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingType.value = null
  form.name = ''
  form.icon = ''
  form.sortOrder = 0
}

async function handleSubmit() {
  if (!form.name) return
  
  loading.value = true
  try {
    if (editingType.value) {
      await authFetch(`/api/admin/resource-types/${editingType.value.id}`, {
        method: 'PUT',
        body: form,
      })
    } else {
      await authFetch('/api/admin/resource-types', {
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

async function deleteType(id: number, name: string) {
  if (!confirm(`确定要删除资源类型「${name}」吗？`)) return
  
  try {
    await authFetch(`/api/admin/resource-types/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

async function batchDelete() {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个资源类型吗？正在使用的类型会自动跳过。`)) return

  try {
    const result = await authFetch<{ deletedCount: number; failed: Array<{ name: string; reason: string }> }>('/api/admin/resource-types/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value },
    })
    selectedIds.value = []
    await refresh()
    const failedText = result.failed.length ? `，${result.failed.length} 个跳过` : ''
    toast.success(`已删除 ${result.deletedCount} 个资源类型${failedText}`)
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

watch(() => resourceTypes.value, () => {
  selectedIds.value = []
})

const siteName = useSiteName()
useHead({
  title: computed(() => `资源类型管理 - ${siteName.value} 管理后台`),
})
</script>

<style scoped>
</style>

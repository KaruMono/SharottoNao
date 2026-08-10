<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">友情链接</h1>
      <button 
        @click="resetForm(); showAddModal = true"
        class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
      >
        <i class="fa-solid fa-plus mr-1.5"></i>添加链接
      </button>
    </div>

    <!-- 链接列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th class="px-4 py-3 text-left text-sm font-medium">链接</th>
            <th class="px-4 py-3 text-left text-sm font-medium">简介</th>
            <th class="px-4 py-3 text-left text-sm font-medium">排序</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="link in friendLinks" :key="link.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3 font-medium">{{ link.name }}</td>
            <td class="px-4 py-3">
              <a :href="link.url" target="_blank" class="text-blue-500 hover:underline text-sm">
                {{ link.url }}
              </a>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
              <span v-if="link.description" class="block truncate" :title="link.description">{{ link.description }}</span>
              <span v-else class="text-gray-300 dark:text-zinc-600">-</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">{{ link.sortOrder }}</td>
            <td class="px-4 py-3 text-right space-x-3">
              <button 
                @click="openEdit(link)"
                class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
              >
                编辑
              </button>
              <button 
                @click="deleteLink(link.id, link.name)"
                class="text-red-500 hover:text-red-600 text-sm"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!friendLinks?.length" class="text-center text-gray-500 py-12">
        暂无友情链接
      </div>
    </div>

    <!-- 添加弹窗 -->
    <Teleport to="body">
    <Transition name="modal">
    <div 
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="showAddModal = false"
    >
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md modal-content">
        <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
          <h3 class="font-semibold">{{ editingId ? '编辑友情链接' : '添加友情链接' }}</h3>
          <button @click="showAddModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <form @submit.prevent="handleSave" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名称 *</label>
            <input 
              v-model="form.name"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">链接 *</label>
            <input 
              v-model="form.url"
              type="url" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Logo URL</label>
            <input 
              v-model="form.logo"
              type="url" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              placeholder="https://..."
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">简介</label>
            <textarea 
              v-model="form.description"
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              rows="2"
              placeholder="可选，鼠标悬停时显示"
              maxlength="255"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">排序</label>
            <input 
              v-model.number="form.sortOrder"
              type="number" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
            />
          </div>
          
          <div class="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              @click="showAddModal = false"
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm"
            >
              取消
            </button>
            <button 
              type="submit"
              :disabled="loading"
              class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm disabled:opacity-50"
            >
              {{ loading ? '保存中...' : (editingId ? '保存' : '添加') }}
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
import type { FriendLinkItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: friendLinks, refresh } = await useAuthFetch<FriendLinkItem[]>('/api/admin/friend-links', { key: 'admin-friend-links' })

const showAddModal = ref(false)
const loading = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  name: '',
  url: '',
  logo: '',
  description: '',
  sortOrder: 0,
})

function resetForm() {
  form.name = ''
  form.url = ''
  form.logo = ''
  form.description = ''
  form.sortOrder = 0
  editingId.value = null
}

function openEdit(link: FriendLinkItem) {
  editingId.value = link.id
  form.name = link.name
  form.url = link.url
  form.logo = link.logo || ''
  form.description = link.description || ''
  form.sortOrder = link.sortOrder ?? 0
  showAddModal.value = true
}

async function handleSave() {
  if (!form.name || !form.url) return
  
  loading.value = true
  try {
    if (editingId.value) {
      await authFetch(`/api/admin/friend-links/${editingId.value}`, {
        method: 'PUT',
        body: form,
      })
      toast.success('保存成功')
    } else {
      await authFetch('/api/admin/friend-links', {
        method: 'POST',
        body: form,
      })
      toast.success('添加成功')
    }
    showAddModal.value = false
    resetForm()
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    loading.value = false
  }
}

async function deleteLink(id: number, name: string) {
  if (!confirm(`确定要删除「${name}」吗？`)) return
  
  try {
    await authFetch(`/api/admin/friend-links/${id}`, { method: 'DELETE' })
    await refresh()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `友情链接 - ${siteName.value} 管理后台`),
})
</script>

<style scoped>
</style>

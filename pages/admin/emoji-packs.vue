<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">表情包管理</h1>
      <AdminKumoButton variant="primary"
        @click="showCreatePackModal = true"
      >
        <Icon name="fa6-solid:plus" />添加表情包
      </AdminKumoButton>
    </div>

    <!-- 表情包列表 -->
    <div class="space-y-4">
      <div 
        v-for="pack in emojiPacks"
        :key="pack.id"
        class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden"
      >
        <!-- 表情包头部 -->
        <div class="p-4 border-b dark:border-zinc-700 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ pack.name }}</span>
              <span 
                class="px-2 py-0.5 text-xs rounded"
                :class="pack.isActive ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-zinc-700'"
              >
                {{ pack.isActive ? '启用' : '禁用' }}
              </span>
            </div>
            <span class="text-sm text-gray-500">{{ pack.emojis?.length || 0 }} 个表情</span>
          </div>
          <div class="flex items-center gap-2">
            <AdminKumoButton variant="secondary" size="toolbar"
              @click="openAddEmojiModal(pack)"
            >
              <Icon name="fa6-solid:plus" />添加表情
            </AdminKumoButton>
            <button 
              @click="editPack(pack)"
              class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Icon name="fa6-solid:pen" />
            </button>
            <button 
              @click="deletePack(pack)"
              class="p-2 text-red-500 hover:text-red-600"
            >
              <Icon name="fa6-solid:trash" />
            </button>
          </div>
        </div>
        <!-- 表情列表 -->
        <div class="p-4">
          <div v-if="pack.emojis?.length" class="flex flex-wrap gap-2">
            <div 
              v-for="emoji in pack.emojis"
              :key="emoji.id"
              class="relative group"
            >
              <div class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                <img :src="emoji.url" :alt="emoji.name" class="w-10 h-10 object-contain" />
              </div>
              <div class="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition">
                <button 
                  @click="deleteEmoji(emoji)"
                  class="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  <Icon name="fa6-solid:xmark" />
                </button>
              </div>
              <div class="text-xs text-center text-gray-500 mt-1 truncate w-12">{{ emoji.name }}</div>
            </div>
          </div>
          <div v-else class="text-gray-500 text-sm">暂无表情，点击上方按钮添加</div>
        </div>
      </div>

      <div v-if="!emojiPacks?.length" class="text-center py-16 text-gray-500">
        <Icon name="fa6-solid:face-smile" class="text-4xl mb-4" />
        <p>暂无表情包</p>
      </div>
    </div>

    <!-- 创建/编辑表情包弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
      <div 
        v-if="showCreatePackModal || editingPack"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="closePackModal"
      >
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 w-96 shadow-xl modal-content">
          <h3 class="font-semibold mb-4">{{ editingPack ? '编辑表情包' : '添加表情包' }}</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm mb-1">名称</label>
              <input 
                v-model="packForm.name"
                type="text"
                class="admin-input w-full"
                placeholder="表情包名称"
              />
            </div>
            <div>
              <label class="block text-sm mb-1">描述</label>
              <textarea 
                v-model="packForm.description"
                class="admin-textarea w-full"
                rows="2"
                placeholder="可选"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm mb-1">排序</label>
              <input 
                v-model.number="packForm.sortOrder"
                type="number"
                class="admin-input w-full"
              />
            </div>
            <div class="flex items-center gap-2">
              <input 
                v-model="packForm.isActive"
                type="checkbox"
                id="pack-active"
                class="rounded"
              />
              <label for="pack-active" class="text-sm">启用</label>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <AdminKumoButton variant="ghost"
              @click="closePackModal"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="primary"
              @click="savePack"
              :disabled="!packForm.name || saving"
            >
              {{ saving ? '保存中...' : '保存' }}
            </AdminKumoButton>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- 添加表情弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
      <div 
        v-if="showAddEmojiModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showAddEmojiModal = false"
      >
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 w-[500px] shadow-xl modal-content">
          <h3 class="font-semibold mb-4">添加表情到「{{ selectedPack?.name }}」</h3>
          <div class="space-y-4">
            <!-- 搜索输入框 -->
            <div>
              <label class="block text-sm mb-1 dark:text-gray-200">搜索表情名称（回车添加）</label>
              <div class="relative">
                <input 
                  v-model="emojiSearchQuery"
                  type="text"
                  class="admin-input w-full"
                  placeholder="输入表情名称，回车添加..."
                  @keyup.enter="addEmojiBySearch"
                />
                <Icon name="fa6-solid:magnifying-glass" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <p class="text-xs text-gray-500 mt-1">输入名称后按回车，将自动创建表情条目</p>
            </div>
            <!-- 待添加的表情列表 -->
            <div v-if="pendingEmojis.length" class="space-y-2">
              <label class="block text-sm dark:text-gray-200">待添加的表情</label>
              <div class="flex flex-wrap gap-2">
                <div 
                  v-for="(emoji, index) in pendingEmojis"
                  :key="index"
                  class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg"
                >
                  <div class="w-10 h-10 rounded bg-gray-200 dark:bg-zinc-600 flex items-center justify-center overflow-hidden">
                    <img v-if="emoji.url" :src="emoji.url" class="w-8 h-8 object-contain" />
                    <Icon name="fa6-solid:image" class="text-gray-400" v-else />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium">{{ emoji.name }}</div>
                    <input 
                      type="file"
                      accept="image/*"
                      class="hidden"
                      :ref="el => setEmojiFileInput(index, el)"
                      @change="e => handlePendingEmojiUpload(e, index)"
                    />
                    <button 
                      @click="emojiFileInputs[index]?.click()"
                      class="text-xs text-blue-500 hover:underline"
                      :disabled="uploading"
                    >
                      {{ emoji.url ? '更换图片' : '上传图片' }}
                    </button>
                  </div>
                  <button 
                    @click="removePendingEmoji(index)"
                    class="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Icon name="fa6-solid:xmark" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500">
              <Icon name="fa6-solid:face-smile" class="text-3xl mb-2" />
              <p class="text-sm">输入表情名称并按回车添加</p>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <AdminKumoButton variant="ghost"
              @click="closeAddEmojiModal"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="primary"
              @click="savePendingEmojis"
              :disabled="!pendingEmojis.length || pendingEmojis.some(e => !e.url) || saving"
            >
              {{ saving ? '保存中...' : `添加 ${pendingEmojis.length} 个表情` }}
            </AdminKumoButton>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { EmojiItem, EmojiPackItem } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()

// 数据
const { data: emojiPacks, refresh } = await useAuthFetch<EmojiPackItem[]>('/api/admin/emoji-packs', { key: 'admin-emoji-packs' })

// 状态
const showCreatePackModal = ref(false)
const showAddEmojiModal = ref(false)
const editingPack = ref<EmojiPackItem | null>(null)
const selectedPack = ref<EmojiPackItem | null>(null)
const saving = ref(false)
const uploading = ref(false)

// 表情包表单
const packForm = reactive({
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
})

// 表情表单
const emojiForm = reactive({
  name: '',
  url: '',
  sortOrder: 0,
})

// 搜索添加表情
const emojiSearchQuery = ref('')
const pendingEmojis = ref<{ name: string; url: string; sortOrder: number }[]>([])
const emojiFileInputs = ref<(HTMLInputElement | null)[]>([])

function editPack(pack: any) {
  editingPack.value = pack
  packForm.name = pack.name
  packForm.description = pack.description || ''
  packForm.sortOrder = pack.sortOrder
  packForm.isActive = pack.isActive
}

function closePackModal() {
  showCreatePackModal.value = false
  editingPack.value = null
  packForm.name = ''
  packForm.description = ''
  packForm.sortOrder = 0
  packForm.isActive = true
}

async function savePack() {
  saving.value = true
  try {
    if (editingPack.value) {
      await authFetch(`/api/admin/emoji-packs/${editingPack.value.id}`, {
        method: 'PUT',
        body: packForm,
      })
      toast.success('表情包更新成功')
    } else {
      await authFetch('/api/admin/emoji-packs', {
        method: 'POST',
        body: packForm,
      })
      toast.success('表情包创建成功')
    }
    closePackModal()
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deletePack(pack: any) {
  if (!confirm(`确定要删除表情包「${pack.name}」吗？包含的所有表情也会被删除。`)) return
  
  try {
    await authFetch(`/api/admin/emoji-packs/${pack.id}`, { method: 'DELETE' })
    toast.success('删除成功')
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

function openAddEmojiModal(pack: any) {
  selectedPack.value = pack
  emojiForm.name = ''
  emojiForm.url = ''
  emojiForm.sortOrder = (pack.emojis?.length || 0)
  emojiSearchQuery.value = ''
  pendingEmojis.value = []
  showAddEmojiModal.value = true
}

function closeAddEmojiModal() {
  showAddEmojiModal.value = false
  emojiSearchQuery.value = ''
  pendingEmojis.value = []
}

function addEmojiBySearch() {
  const name = emojiSearchQuery.value.trim()
  if (!name) return
  
  // 检查是否已存在
  if (pendingEmojis.value.some(e => e.name === name)) {
    toast.error('该表情名称已添加')
    return
  }
  
  pendingEmojis.value.push({
    name,
    url: '',
    sortOrder: (selectedPack.value?.emojis?.length || 0) + pendingEmojis.value.length,
  })
  emojiSearchQuery.value = ''
}

function removePendingEmoji(index: number) {
  pendingEmojis.value.splice(index, 1)
  emojiFileInputs.value.splice(index, 1)
}

function setEmojiFileInput(index: number, el: Element | ComponentPublicInstance | null) {
  emojiFileInputs.value[index] = el instanceof HTMLInputElement ? el : null
}

async function handlePendingEmojiUpload(event: Event, index: number) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'emoji')

    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })
    pendingEmojis.value[index].url = result.url
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function savePendingEmojis() {
  if (!selectedPack.value || !pendingEmojis.value.length) return
  
  // 检查所有表情是否都有图片
  if (pendingEmojis.value.some(e => !e.url)) {
    toast.error('请为所有表情上传图片')
    return
  }
  
  saving.value = true
  try {
    for (const emoji of pendingEmojis.value) {
      await authFetch(`/api/admin/emoji-packs/${selectedPack.value.id}/emojis`, {
        method: 'POST',
        body: emoji,
      })
    }
    toast.success(`成功添加 ${pendingEmojis.value.length} 个表情`)
    closeAddEmojiModal()
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '添加失败')
  } finally {
    saving.value = false
  }
}

async function handleEmojiUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'emoji')

    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })
    emojiForm.url = result.url
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function saveEmoji() {
  if (!selectedPack.value) return
  
  saving.value = true
  try {
    await authFetch(`/api/admin/emoji-packs/${selectedPack.value.id}/emojis`, {
      method: 'POST',
      body: emojiForm,
    })
    toast.success('表情添加成功')
    showAddEmojiModal.value = false
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '添加失败')
  } finally {
    saving.value = false
  }
}

async function deleteEmoji(emoji: any) {
  if (!confirm(`确定要删除表情「${emoji.name}」吗？`)) return
  
  try {
    await authFetch(`/api/admin/emojis/${emoji.id}`, { method: 'DELETE' })
    toast.success('删除成功')
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

useHead({
  title: '表情包管理 - 管理后台',
})
</script>

<style scoped>
</style>

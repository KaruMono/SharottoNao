<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">工具管理</h1>
      <div class="flex items-center gap-3">
        <div class="flex bg-gray-100 dark:bg-zinc-700 rounded-lg p-0.5">
          <button
            @click="activeTab = 'tools'"
            class="px-4 py-1.5 rounded-md text-sm font-medium transition"
            :class="activeTab === 'tools' ? 'bg-white dark:bg-zinc-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          >
            <i class="fa-solid fa-wrench mr-1.5"></i>工具列表
          </button>
          <button
            @click="activeTab = 'categories'"
            class="px-4 py-1.5 rounded-md text-sm font-medium transition"
            :class="activeTab === 'categories' ? 'bg-white dark:bg-zinc-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          >
            <i class="fa-solid fa-folder mr-1.5"></i>分类管理
          </button>
        </div>
        <button
          v-if="activeTab === 'tools'"
          @click="openToolModal()"
          class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 flex items-center gap-1.5"
        >
          <i class="fa-solid fa-plus"></i>添加工具
        </button>
        <button
          v-if="activeTab === 'categories'"
          @click="openCategoryModal()"
          class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 flex items-center gap-1.5"
        >
          <i class="fa-solid fa-plus"></i>添加分类
        </button>
      </div>
    </div>

    <!-- ==================== 分类管理 ==================== -->
    <div v-if="activeTab === 'categories'">
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-zinc-700">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
              <th class="px-4 py-3 text-left text-sm font-medium">Slug</th>
              <th class="px-4 py-3 text-left text-sm font-medium">图标</th>
              <th class="px-4 py-3 text-left text-sm font-medium">工具数</th>
              <th class="px-4 py-3 text-left text-sm font-medium">排序</th>
              <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y dark:divide-zinc-700">
            <tr v-for="cat in categories" :key="cat.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
              <td class="px-4 py-3 font-medium">
                <i v-if="cat.icon" :class="cat.icon" class="mr-2 text-gray-400"></i>
                {{ cat.name }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                <code class="bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-xs">{{ cat.slug }}</code>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ cat.icon || '-' }}</td>
              <td class="px-4 py-3 text-sm">{{ cat._count?.tools ?? 0 }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ cat.sortOrder }}</td>
              <td class="px-4 py-3 text-right space-x-3">
                <button @click="openCategoryModal(cat)" class="text-blue-500 hover:text-blue-600 text-sm">编辑</button>
                <button @click="deleteCategory(cat)" class="text-red-500 hover:text-red-600 text-sm">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!categories?.length" class="text-center text-gray-500 py-12">暂无分类</div>
      </div>
    </div>

    <!-- ==================== 工具列表 ==================== -->
    <div v-if="activeTab === 'tools'">
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
        <select
          v-model="filterCategoryId"
          class="px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
        >
          <option :value="0">全部分类</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
      </div>

      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-zinc-700">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium">图标</th>
              <th class="px-4 py-3 text-left text-sm font-medium">名称</th>
              <th class="px-4 py-3 text-left text-sm font-medium hidden md:table-cell">版本</th>
              <th class="px-4 py-3 text-left text-sm font-medium hidden md:table-cell">作者</th>
              <th class="px-4 py-3 text-left text-sm font-medium">分类</th>
              <th class="px-4 py-3 text-left text-sm font-medium hidden md:table-cell">排序</th>
              <th class="px-4 py-3 text-left text-sm font-medium hidden lg:table-cell">GitHub</th>
              <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y dark:divide-zinc-700">
            <tr v-for="tool in filteredTools" :key="tool.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
              <td class="px-4 py-3">
                <img
                  v-if="tool.icon"
                  :src="tool.icon"
                  :alt="tool.name"
                  class="w-10 h-10 rounded-lg object-cover"
                />
                <div v-else class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
                  <i class="fa-solid fa-wrench text-gray-400"></i>
                </div>
              </td>
              <td class="px-4 py-3 font-medium">{{ tool.name }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{{ tool.version || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{{ tool.author || '-' }}</td>
              <td class="px-4 py-3 text-sm">
                <span class="bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-xs">{{ tool.category?.name }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{{ tool.sortOrder }}</td>
              <td class="px-4 py-3 text-sm hidden lg:table-cell">
                <a v-if="tool.githubUrl" :href="tool.githubUrl" target="_blank" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <i class="fa-brands fa-github"></i>
                </a>
                <span v-else class="text-gray-300 dark:text-zinc-600">-</span>
              </td>
              <td class="px-4 py-3 text-right space-x-3">
                <button @click="openToolModal(tool)" class="text-blue-500 hover:text-blue-600 text-sm">编辑</button>
                <button @click="deleteTool(tool)" class="text-red-500 hover:text-red-600 text-sm">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!filteredTools?.length" class="text-center text-gray-500 py-12">暂无工具</div>
      </div>
    </div>

    <!-- ==================== 分类弹窗 ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCategoryModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showCategoryModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md modal-content">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">{{ editingCategory ? '编辑分类' : '添加分类' }}</h3>
              <button @click="showCategoryModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form @submit.prevent="handleSaveCategory" class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">名称 *</label>
                <input v-model="categoryForm.name" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Slug *</label>
                <input v-model="categoryForm.slug" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如 windows, android, ios" required />
                <p class="text-xs text-gray-400 mt-1">只能包含小写字母、数字和连字符</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">图标 (FontAwesome)</label>
                <input v-model="categoryForm.icon" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如 fa-brands fa-windows" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">排序</label>
                <input v-model.number="categoryForm.sortOrder" type="number" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" />
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" @click="showCategoryModal = false" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm">取消</button>
                <button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm disabled:opacity-50">
                  {{ saving ? '保存中...' : '保存' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ==================== 工具弹窗 ==================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showToolModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
          @click.self="showToolModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg modal-content my-8">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">{{ editingTool ? '编辑工具' : '添加工具' }}</h3>
              <button @click="showToolModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form @submit.prevent="handleSaveTool" class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">名称 *</label>
                <input v-model="toolForm.name" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">简介</label>
                <textarea v-model="toolForm.description" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" rows="3" placeholder="软件功能简介"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">图标</label>
                <div class="flex items-center gap-3">
                  <img v-if="toolForm.icon" :src="toolForm.icon" class="w-14 h-14 rounded-lg object-cover border dark:border-zinc-600" />
                  <div v-else class="w-14 h-14 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center border dark:border-zinc-600">
                    <i class="fa-solid fa-image text-gray-400"></i>
                  </div>
                  <div class="flex-1">
                    <input ref="iconFileInput" type="file" accept="image/*" class="hidden" @change="handleIconUpload" />
                    <button type="button" @click="iconFileInput?.click()" :disabled="uploading" class="px-3 py-1.5 rounded-lg border dark:border-zinc-600 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition disabled:opacity-50">
                      {{ uploading ? '上传中...' : '上传图标' }}
                    </button>
                    <button v-if="toolForm.icon" type="button" @click="toolForm.icon = ''" class="ml-2 text-red-500 text-sm hover:underline">移除</button>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">版本</label>
                  <input v-model="toolForm.version" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="如 1.0.0" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">作者</label>
                  <input v-model="toolForm.author" type="text" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">下载链接 *</label>
                <input v-model="toolForm.downloadUrl" type="url" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="https://..." required />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">GitHub 链接</label>
                <input v-model="toolForm.githubUrl" type="url" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" placeholder="https://github.com/..." />
                <p class="text-xs text-gray-400 mt-1">可选，填写后前台会显示 GitHub 图标按钮</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">分类 *</label>
                  <select v-model.number="toolForm.categoryId" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" required>
                    <option :value="0" disabled>请选择分类</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">排序</label>
                  <input v-model.number="toolForm.sortOrder" type="number" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" />
                </div>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button type="button" @click="showToolModal = false" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm">取消</button>
                <button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm disabled:opacity-50">
                  {{ saving ? '保存中...' : '保存' }}
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

const { authFetch } = useAuthRequest()
const toast = useToast()

const activeTab = ref<'tools' | 'categories'>('tools')
const saving = ref(false)
const uploading = ref(false)
const iconFileInput = ref<HTMLInputElement>()

// ==================== 分类 ====================
const { data: categories, refresh: refreshCategories } = await useAuthFetch<any[]>('/api/admin/tool-categories')

const showCategoryModal = ref(false)
const editingCategory = ref<any>(null)
const categoryForm = reactive({
  name: '',
  slug: '',
  icon: '',
  sortOrder: 0,
})

function openCategoryModal(cat?: any) {
  if (cat) {
    editingCategory.value = cat
    categoryForm.name = cat.name
    categoryForm.slug = cat.slug
    categoryForm.icon = cat.icon || ''
    categoryForm.sortOrder = cat.sortOrder
  } else {
    editingCategory.value = null
    categoryForm.name = ''
    categoryForm.slug = ''
    categoryForm.icon = ''
    categoryForm.sortOrder = 0
  }
  showCategoryModal.value = true
}

async function handleSaveCategory() {
  if (!categoryForm.name || !categoryForm.slug) return
  saving.value = true
  try {
    if (editingCategory.value) {
      await authFetch(`/api/admin/tool-categories/${editingCategory.value.id}`, { method: 'PUT', body: categoryForm })
      toast.success('编辑成功')
    } else {
      await authFetch('/api/admin/tool-categories', { method: 'POST', body: categoryForm })
      toast.success('添加成功')
    }
    showCategoryModal.value = false
    await refreshCategories()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteCategory(cat: any) {
  if (!confirm(`确定要删除分类「${cat.name}」吗？`)) return
  try {
    await authFetch(`/api/admin/tool-categories/${cat.id}`, { method: 'DELETE' })
    await refreshCategories()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

// ==================== 工具 ====================
const { data: tools, refresh: refreshTools } = await useAuthFetch<any[]>('/api/admin/tools', { key: 'admin-tools' })
const filterCategoryId = ref(0)

const filteredTools = computed(() => {
  if (!tools.value) return []
  if (!filterCategoryId.value) return tools.value
  return tools.value.filter((t: any) => t.categoryId === filterCategoryId.value)
})

const showToolModal = ref(false)
const editingTool = ref<any>(null)
const toolForm = reactive({
  name: '',
  description: '',
  icon: '',
  version: '',
  author: '',
  downloadUrl: '',
  githubUrl: '',
  categoryId: 0,
  sortOrder: 0,
})

function openToolModal(tool?: any) {
  if (tool) {
    editingTool.value = tool
    toolForm.name = tool.name
    toolForm.description = tool.description || ''
    toolForm.icon = tool.icon || ''
    toolForm.version = tool.version || ''
    toolForm.author = tool.author || ''
    toolForm.downloadUrl = tool.downloadUrl
    toolForm.githubUrl = tool.githubUrl || ''
    toolForm.categoryId = tool.categoryId
    toolForm.sortOrder = tool.sortOrder
  } else {
    editingTool.value = null
    toolForm.name = ''
    toolForm.description = ''
    toolForm.icon = ''
    toolForm.version = ''
    toolForm.author = ''
    toolForm.downloadUrl = ''
    toolForm.githubUrl = ''
    toolForm.categoryId = categories.value?.[0]?.id || 0
    toolForm.sortOrder = 0
  }
  showToolModal.value = true
}

async function handleIconUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'tool')
    const result = await authFetch<{ url: string }>('/api/upload/image', { method: 'POST', body: formData })
    toolForm.icon = result.url
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    uploading.value = false
    if (iconFileInput.value) iconFileInput.value.value = ''
  }
}

async function handleSaveTool() {
  if (!toolForm.name || !toolForm.downloadUrl || !toolForm.categoryId) return
  saving.value = true
  try {
    const body = {
      ...toolForm,
      description: toolForm.description || null,
      icon: toolForm.icon || null,
      version: toolForm.version || null,
      author: toolForm.author || null,
      githubUrl: toolForm.githubUrl || null,
    }
    if (editingTool.value) {
      await authFetch(`/api/admin/tools/${editingTool.value.id}`, { method: 'PUT', body })
      toast.success('编辑成功')
    } else {
      await authFetch('/api/admin/tools', { method: 'POST', body })
      toast.success('添加成功')
    }
    showToolModal.value = false
    await refreshTools()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteTool(tool: any) {
  if (!confirm(`确定要删除工具「${tool.name}」吗？`)) return
  try {
    await authFetch(`/api/admin/tools/${tool.id}`, { method: 'DELETE' })
    await refreshTools()
    toast.success('删除成功')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `工具管理 - ${siteName.value} 管理后台`),
})
</script>

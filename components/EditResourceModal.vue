<template>
  <Teleport to="body">
    <Transition name="modal">
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg modal-content max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
        <h3 class="font-semibold">编辑下载资源</h3>
        <button @click="emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="p-4 space-y-4 overflow-y-auto flex-1">
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">资源标题 *</label>
          <input 
            v-model="form.title"
            type="text" 
            class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="如：官方原版整合"
            required
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">资源类型 *</label>
          <select 
            v-model="form.typeId"
            class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none"
            required
          >
            <option value="">请选择类型</option>
            <option v-for="type in resourceTypes" :key="type.id" :value="type.id">
              {{ type.name }}
            </option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">下载链接 *</label>
          <input 
            v-model="form.url"
            type="url" 
            class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="https://..."
            required
          />
        </div>

        <!-- 语言 + 大小 -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-200">游戏语言 *</label>
            <select
              v-model="form.language"
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none"
              required
            >
              <option value="">请选择语言</option>
              <option value="ja">日文</option>
              <option value="en">英文</option>
              <option value="zh-Hans">简体中文</option>
              <option value="zh-Hant">繁体中文</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-200">文件大小 *</label>
            <input
              v-model="form.fileSize"
              type="text"
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="如 1.2G、800M"
              pattern="^[\d.]+[MmGg]$"
              title="文件大小必须以M或G结尾，如：1.2G、800M"
              required
            />
          </div>
        </div>

        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            v-model="form.isMachineTranslated"
            type="checkbox"
            class="rounded border-gray-300 dark:border-zinc-600"
          />
          <span class="text-sm dark:text-gray-200">机翻资源</span>
        </label>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-200">提取密码</label>
            <input 
              v-model="form.extractCode"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="可选"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 dark:text-gray-200">解压密码</label>
            <input 
              v-model="form.unzipPassword"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="可选"
            />
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">备注</label>
          <textarea 
            v-model="form.remark"
            class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="2"
            placeholder="可选，如：包含本体 + DLC"
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-3 pt-2">
          <button 
            type="button"
            @click="emit('close')"
            class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            取消
          </button>
          <button 
            type="submit"
            :disabled="loading"
            class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
          >
            {{ loading ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Resource {
  id: number
  title: string
  url: string
  extractCode?: string | null
  unzipPassword?: string | null
  remark?: string | null
  language?: string | null
  fileSize?: string | null
  isMachineTranslated?: boolean
  type: { id: number; name: string }
}

const props = defineProps<{
  resource: Resource
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { authFetch } = useAuthRequest()
const toast = useToast()

const { data: resourceTypes } = await useFetch('/api/resource-types', {
  key: 'edit-resource-types',
  getCachedData: () => undefined as any,
})

const form = reactive({
  title: props.resource.title,
  typeId: props.resource.type.id,
  url: props.resource.url,
  extractCode: props.resource.extractCode || '',
  unzipPassword: props.resource.unzipPassword || '',
  remark: props.resource.remark || '',
  language: props.resource.language || '',
  fileSize: props.resource.fileSize || '',
  isMachineTranslated: props.resource.isMachineTranslated ?? false,
})

const loading = ref(false)

async function handleSubmit() {
  if (!form.title || !form.typeId || !form.url || !form.language || !form.fileSize) return
  
  // 验证文件大小格式
  if (!/^[\d.]+[MmGg]$/.test(form.fileSize)) {
    toast.error('文件大小必须以M或G结尾，如：1.2G、800M')
    return
  }
  
  loading.value = true
  try {
    await authFetch(`/api/resources/${props.resource.id}`, {
      method: 'PUT',
      body: {
        typeId: form.typeId,
        title: form.title,
        url: form.url,
        extractCode: form.extractCode || null,
        unzipPassword: form.unzipPassword || null,
        remark: form.remark || null,
        language: form.language,
        fileSize: form.fileSize,
        isMachineTranslated: form.isMachineTranslated,
      },
    })
    toast.success('资源保存成功')
    emit('success')
  } catch (error: any) {
    toast.error(error.data?.message || error.message || '保存失败')
  } finally {
    loading.value = false
  }
}
</script>

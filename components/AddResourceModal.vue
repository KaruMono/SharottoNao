<template>
  <Teleport to="body">
    <Transition name="modal">
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg modal-content max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
        <h3 class="font-semibold">添加下载资源</h3>
        <button @click="emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
          <Icon name="fa6-solid:xmark" />
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
          <div class="relative">
            <input 
              v-model="form.url"
              type="url" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="https://..."
              required
              @change="onUrlChange"
              @paste="onUrlPaste"
            />
            <span v-if="fetchingAlist" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              <Icon name="fa6-solid:spinner" class="fa-spin mr-1" />获取信息...
            </span>
          </div>
        </div>

        <!-- 语言 + 大小 + 机翻 -->
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
          <span class="text-xs text-gray-400">（勾选表示该资源使用机器翻译）</span>
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
            {{ loading ? '提交中...' : '提交' }}
          </button>
        </div>
      </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  gameId?: number
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { authFetch } = useAuthRequest()
const toast = useToast()

const { data: resourceTypesData } = await (useFetch as any)('/api/resource-types', {
  key: 'add-resource-types',
  getCachedData: () => undefined as any,
})
const resourceTypes = computed(() => (resourceTypesData.value ?? []) as any[])

const form = reactive({
  title: '',
  typeId: '',
  url: '',
  extractCode: '',
  unzipPassword: '',
  remark: '',
  language: '',
  fileSize: '',
  isMachineTranslated: false,
})

const loading = ref(false)
const fetchingAlist = ref(false)

async function tryFetchAlistInfo(url: string) {
  if (!url) return
  fetchingAlist.value = true
  try {
    const result: any = await $fetch('/api/alist/file-info', {
      params: { url },
    } as any)
    if (result.name && !form.title) {
      form.title = result.name
    }
    if (result.sizeFormatted && !form.fileSize) {
      form.fileSize = result.sizeFormatted
    }
  } catch {
    // 不是 Alist 链接或获取失败，静默忽略
  } finally {
    fetchingAlist.value = false
  }
}

function onUrlChange() {
  tryFetchAlistInfo(form.url)
}

function onUrlPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text')
  if (text) {
    nextTick(() => tryFetchAlistInfo(form.url))
  }
}

async function handleSubmit() {
  if (!props.gameId || !form.title || !form.typeId || !form.url || !form.language || !form.fileSize) return
  
  // 验证文件大小格式
  if (!/^[\d.]+[MmGg]$/.test(form.fileSize)) {
    toast.error('文件大小必须以M或G结尾，如：1.2G、800M')
    return
  }

  loading.value = true
  try {
    const result: any = await (authFetch as any)(`/api/games/${props.gameId}/resource`, {
      method: 'POST',
      body: {
        typeId: parseInt(form.typeId),
        title: form.title,
        url: form.url,
        extractCode: form.extractCode || undefined,
        unzipPassword: form.unzipPassword || undefined,
        remark: form.remark || undefined,
        language: form.language,
        fileSize: form.fileSize,
        isMachineTranslated: form.isMachineTranslated || undefined,
      },
    })
    if (result.status === 'PENDING') {
      toast.success('资源已提交，等待管理员审核')
    } else {
      toast.success('资源添加成功')
    }
    emit('success')
  } catch (error: any) {
    toast.error(error.data?.message || error.message || '添加失败')
  } finally {
    loading.value = false
  }
}
</script>

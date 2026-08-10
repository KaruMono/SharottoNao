<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Alist 资源扫描</h1>

    <!-- 操作面板 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6 space-y-4">
      <p class="text-sm text-gray-500">扫描所有 Alist 网盘资源，自动获取文件大小（支持文件夹），可为每个资源单独设置语言和机翻标记（默认简体中文）；批量设置将覆盖所有资源的单独设置。</p>

      <!-- 批量设置选项 -->
      <div class="flex flex-wrap items-end gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">批量覆盖语言（留空保留各自设置）</label>
          <select v-model="batchLanguage" class="px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm">
            <option value="">不覆盖</option>
            <option value="ja">日文</option>
            <option value="en">英文</option>
            <option value="zh-Hans">简体中文</option>
            <option value="zh-Hant">繁体中文</option>
          </select>
        </div>
        <label class="flex items-center gap-2 cursor-pointer select-none pb-0.5">
          <input v-model="batchMachineTranslated" type="checkbox" class="rounded border-gray-300 dark:border-zinc-600" />
          <span class="text-sm">批量标记机翻（覆盖各自设置）</span>
        </label>
      </div>

      <div class="flex items-center gap-3">
        <button
          :disabled="scanning || fetching"
          class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
          @click="startScan"
        >
          <i class="fa-solid fa-magnifying-glass mr-1"></i>{{ scanning ? '查询中...' : '查询 Alist 资源' }}
        </button>
        <button
          v-if="resources.length && !fetching"
          :disabled="fetching"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
          @click="fetchAllSizes"
        >
          <i class="fa-solid fa-ruler-combined mr-1"></i>开始获取大小
        </button>
        <button
          v-if="needUpdate.length"
          :disabled="updating"
          class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 disabled:opacity-50"
          @click="batchUpdate"
        >
          <i class="fa-solid fa-check mr-1"></i>{{ updating ? '更新中...' : `一键补全 (${selectedCount})` }}
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="fetching" class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <div class="flex items-center justify-between text-sm mb-2">
        <span>正在获取文件大小...</span>
        <span>{{ fetchProgress }} / {{ resources.length }}</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
        <div
          class="bg-blue-500 h-2 rounded-full transition-all"
          :style="{ width: `${(fetchProgress / resources.length) * 100}%` }"
        ></div>
      </div>
    </div>

    <!-- 查询结果概览 -->
    <div v-if="resources.length && !fetching && !fetchDone" class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <p class="text-sm">找到 <span class="font-semibold">{{ resources.length }}</span> 个 Alist 资源，点击「开始获取大小」逐个从 Alist 获取文件大小。</p>
    </div>

    <!-- 扫描完成结果 -->
    <div v-if="fetchDone" class="space-y-4">
      <div class="text-sm text-gray-500">
        共 {{ resources.length }} 个资源，{{ needUpdate.length }} 个可补全，{{ errorItems.length }} 个获取失败
      </div>

      <!-- 需要更新的 -->
      <div v-if="needUpdate.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="p-4 border-b dark:border-zinc-700 flex items-center justify-between">
          <h2 class="font-semibold">可补全资源</h2>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
            全选
          </label>
        </div>
        <div class="divide-y dark:divide-zinc-700 max-h-[600px] overflow-y-auto">
          <div v-for="item in needUpdate" :key="item.id" class="p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/30">
            <div class="flex items-start gap-3">
              <input type="checkbox" v-model="item.selected" class="mt-1 rounded" />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-500 mb-1">
                  <NuxtLink :to="`/games/${item.gameId}`" class="text-blue-500 hover:underline" target="_blank">{{ item.gameTitle }}</NuxtLink>
                  · 资源 #{{ item.id }}
                </div>
                <div class="text-sm font-medium mb-2">{{ item.title }}</div>
                <div class="flex flex-wrap items-center gap-3">
                  <!-- 文件大小 -->
                  <span v-if="item.newSize" class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
                    <i class="fa-solid fa-hard-drive mr-1"></i>
                    <template v-if="item.fileSize">{{ item.fileSize }} → </template>{{ item.newSize }}
                  </span>
                  <!-- 每项语言选择 -->
                  <select
                    v-model="item.language"
                    class="px-2 py-0.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-xs"
                  >
                    <option value="zh-Hans">简体中文</option>
                    <option value="ja">日文</option>
                    <option value="en">英文</option>
                    <option value="zh-Hant">繁体中文</option>
                  </select>
                  <!-- 每项机翻勾选 -->
                  <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" v-model="item.isMachineTranslated" class="rounded" />
                    <span>机翻</span>
                  </label>
                </div>
                <div class="text-xs text-gray-400 mt-1 truncate">{{ item.url }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 获取失败的 -->
      <div v-if="errorItems.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="p-4 border-b dark:border-zinc-700">
          <h2 class="font-semibold text-red-500">获取失败</h2>
        </div>
        <div class="divide-y dark:divide-zinc-700 max-h-[400px] overflow-y-auto">
          <div v-for="item in errorItems" :key="item.id" class="p-4 text-sm">
            <div class="text-gray-500">
              <NuxtLink :to="`/games/${item.gameId}`" class="text-blue-500 hover:underline" target="_blank">{{ item.gameTitle }}</NuxtLink>
              · 资源 #{{ item.id }}
            </div>
            <div class="text-red-500 text-xs mt-1">{{ item.error }}</div>
            <div class="text-xs text-gray-400 mt-1 truncate">{{ item.url }}</div>
          </div>
        </div>
      </div>

      <div v-if="unchangedCount" class="text-sm text-gray-400">
        另有 {{ unchangedCount }} 个资源大小已填写且一致，无需更新。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { authFetch } = useAuthRequest()
const toast = useToast()

const scanning = ref(false)
const fetching = ref(false)
const fetchDone = ref(false)
const updating = ref(false)
const fetchProgress = ref(0)
const batchLanguage = ref('')
const batchMachineTranslated = ref(false)

interface ResourceItem {
  id: number
  title: string
  url: string
  gameId: number
  gameTitle: string
  fileSize: string | null
  currentLanguage: string | null
  newSize?: string | null
  error?: string
  selected?: boolean
  language: string
  isMachineTranslated: boolean
}

const resources = ref<ResourceItem[]>([])

const needUpdate = computed(() => resources.value.filter(r => (r.newSize || batchLanguage.value || batchMachineTranslated.value) && !r.error))
const errorItems = computed(() => resources.value.filter(r => r.error))
const unchangedCount = computed(() => resources.value.filter(r => !r.newSize && !r.error && r.newSize !== undefined).length)
const allSelected = computed(() => needUpdate.value.length > 0 && needUpdate.value.every(r => r.selected))
const selectedCount = computed(() => needUpdate.value.filter(r => r.selected).length)

const LANG_LABELS: Record<string, string> = {
  ja: '日文',
  en: '英文',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁体中文',
}

function langLabel(lang: string | null | undefined): string {
  return lang ? LANG_LABELS[lang] || lang : ''
}

function toggleAll() {
  const val = !allSelected.value
  needUpdate.value.forEach(r => r.selected = val)
}

async function startScan() {
  scanning.value = true
  fetchDone.value = false
  fetchProgress.value = 0
  try {
    const data = await authFetch<{ total: number; resources: ResourceItem[] }>('/api/admin/scan-alist', {
      method: 'POST',
    })
    resources.value = data.resources.map(r => ({
      ...r,
      language: r.currentLanguage || 'zh-Hans',
      isMachineTranslated: false,
    }))
    if (!data.total) {
      toast.info('没有找到 Alist 资源')
    } else {
      toast.success(`找到 ${data.total} 个 Alist 资源`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '查询失败')
  } finally {
    scanning.value = false
  }
}

async function fetchAllSizes() {
  fetching.value = true
  fetchProgress.value = 0
  fetchDone.value = false

  for (let i = 0; i < resources.value.length; i++) {
    const item = resources.value[i]
    try {
      const result = await $fetch<{ name: string; sizeFormatted: string }>('/api/alist/file-info', {
        params: { url: item.url },
      })
      if (result.sizeFormatted && result.sizeFormatted !== item.fileSize) {
        item.newSize = result.sizeFormatted
        item.selected = true
      } else {
        item.newSize = null
      }
    } catch (err: any) {
      item.error = err.data?.message || err.message || '获取失败'
    }
    fetchProgress.value = i + 1
  }

  fetching.value = false
  fetchDone.value = true
  toast.success(`获取完成，${needUpdate.value.length} 个可补全`)
}

async function batchUpdate() {
  const selected = needUpdate.value.filter(r => r.selected)
  if (!selected.length) {
    toast.error('请选择要更新的资源')
    return
  }

  updating.value = true
  try {
    const updates = selected.map(r => {
      const update: Record<string, unknown> = { id: r.id }
      if (r.newSize) update.fileSize = r.newSize
      update.language = batchLanguage.value || r.language
      update.isMachineTranslated = batchMachineTranslated.value || r.isMachineTranslated
      return update
    })

    const result = await authFetch<{ updated: number; errors: string[] }>('/api/admin/batch-update-titles', {
      method: 'POST',
      body: { updates },
    })
    toast.success(`成功更新 ${result.updated} 个资源`)
    selected.forEach(r => {
      if (r.newSize) r.fileSize = r.newSize
      r.newSize = null
      r.selected = false
    })
  } catch (error: any) {
    toast.error(error.data?.message || '更新失败')
  } finally {
    updating.value = false
  }
}

useHead({ title: 'Alist 资源扫描 - 管理后台' })
</script>

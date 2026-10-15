<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8 text-center">
      <!-- 加载中 -->
      <div v-if="pending" class="py-8">
        <Icon name="fa6-solid:spinner" class="fa-spin text-4xl text-gray-400 mb-4" />
        <p class="text-gray-500">正在加载...</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="py-8">
        <Icon name="fa6-solid:circle-exclamation" class="text-4xl text-red-500 mb-4" />
        <h2 class="text-xl font-semibold mb-2">获取失败</h2>
        <p class="text-gray-500 mb-6">{{ (error as any).data?.message || '工具不存在或已被删除' }}</p>
        <NuxtLink to="/tools" class="px-6 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 transition">
          返回工具箱
        </NuxtLink>
      </div>

      <!-- 下载确认 -->
      <div v-else-if="tool" class="py-4">
        <!-- 图标 -->
        <div class="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden">
          <img v-if="tool.icon" :src="tool.icon" :alt="tool.name" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
            <Icon name="fa6-solid:wrench" class="text-3xl text-gray-400" />
          </div>
        </div>

        <h2 class="text-xl font-semibold mb-1">{{ tool.name }}</h2>

        <div class="flex items-center justify-center gap-3 text-xs text-gray-400 mb-2">
          <span v-if="tool.version">
            <Icon name="fa6-solid:code-branch" class="mr-1" />v{{ tool.version }}
          </span>
          <span v-if="tool.author">
            <Icon name="fa6-solid:user" class="mr-1" />{{ tool.author }}
          </span>
          <span v-if="tool.category">
            <FaIcon v-if="tool.category.icon" :icon="tool.category.icon" class="mr-1" />
            {{ tool.category.name }}
          </span>
        </div>

        <p v-if="tool.description" class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          {{ tool.description }}
        </p>

        <div class="space-y-3">
          <div v-if="countdown > 0" class="text-gray-500">
            <span class="text-3xl font-bold text-gray-800 dark:text-white">{{ countdown }}</span>
            <span class="text-sm ml-1">秒后可下载</span>
          </div>

          <template v-else>
            <button
              @click="handleDownload"
              :disabled="downloading"
              class="w-full px-6 py-3 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 transition disabled:opacity-50"
            >
              <Icon name="fa6-solid:download" class="mr-2" />
              {{ downloading ? '跳转中...' : '立即下载' }}
            </button>
            <a
              v-if="tool.githubUrl"
              :href="tool.githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full px-6 py-3 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
            >
              <Icon name="fa6-brands:github" class="text-lg" />
              在 GitHub 上查看
            </a>
          </template>
        </div>

        <NuxtLink to="/tools" class="inline-block mt-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
          <Icon name="fa6-solid:arrow-left" class="mr-1" />返回工具箱
        </NuxtLink>

        <p class="text-xs text-gray-400 mt-6">
          下载即表示您同意遵守相关法律法规，软件版权归原作者所有
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const toolId = computed(() => parseInt(route.params.id as string))

const { data: tool, pending, error } = await (useFetch as any)(`/api/tool-download/${toolId.value}`, { key: `tool-download-${toolId.value}` })

const countdown = ref(5)
const downloading = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (tool.value) {
    timer = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value--
      } else if (timer) {
        clearInterval(timer)
      }
    }, 1000)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function handleDownload() {
  if (!tool.value || downloading.value) return
  downloading.value = true
  window.open(tool.value.downloadUrl, '_blank')
  toast.success('下载链接已打开')
  setTimeout(() => { downloading.value = false }, 1000)
}

const siteName = useSiteName()
useHead({
  title: computed(() => tool.value ? `${tool.value.name} 下载确认与软件信息 - ${siteName.value}` : `工具下载确认 - ${siteName.value}`),
  meta: computed(() => {
    const desc = tool.value?.description || '工具下载确认页会展示软件名称、版本、作者、分类和外部下载入口，请确认目标工具信息后继续访问下载链接。'
    return [
      { name: 'description', content: desc },
      { name: 'robots', content: 'noindex, follow', key: 'robots' },
      { property: 'og:title', content: tool.value ? `${tool.value.name} 下载确认与软件信息 - ${siteName.value}` : `工具下载确认 - ${siteName.value}` },
      { property: 'og:description', content: desc },
    ]
  }),
})
</script>

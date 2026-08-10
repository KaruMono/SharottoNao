<template>
  <div class="fixed inset-0 flex items-center justify-center px-4">
    <div class="max-w-md w-full space-y-4">
    <AdBanner ad-slot="download_top" />
    <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8 text-center">
      <!-- 加载中 -->
      <div v-if="pending" class="py-8">
        <i class="fa-solid fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
        <p class="text-gray-500">正在验证...</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="py-8">
        <i class="fa-solid fa-circle-exclamation text-4xl text-red-500 mb-4"></i>
        <h2 class="text-xl font-semibold mb-2">获取失败</h2>
        <p class="text-gray-500 mb-6">{{ error.data?.message || '资源不存在或已被删除' }}</p>
        <NuxtLink to="/" class="px-6 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 transition">
          返回首页
        </NuxtLink>
      </div>

      <!-- 下载限制 -->
      <div v-else-if="limitReached" class="py-8">
        <i class="fa-solid fa-hand text-4xl text-amber-500 mb-4"></i>
        <h2 class="text-xl font-semibold mb-2">今日下载已达上限</h2>
        <p class="text-gray-500 mb-2">您今天已下载 {{ dailyLimit }} 个资源</p>
        <p class="text-sm text-gray-400 mb-6">请明天再来，或提升权限组获取更多下载次数</p>
        <NuxtLink :to="`/games/${resource?.game?.id}`" class="px-6 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 transition">
          返回游戏页
        </NuxtLink>
      </div>

      <!-- 下载确认 -->
      <div v-else-if="resource" class="py-4">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
          <i :class="resource.netDiskType?.icon || 'fa-solid fa-cloud-arrow-down'" class="text-2xl text-gray-600 dark:text-gray-300"></i>
        </div>
        <h2 class="text-xl font-semibold mb-2">{{ resource.title }}</h2>
        <p class="text-sm text-gray-500 mb-1">
          来自：<NuxtLink :to="`/games/${resource.game?.id}`" class="hover:underline">{{ resource.game?.title }}</NuxtLink>
        </p>
        <p class="text-xs text-gray-400 mb-3">
          <span v-if="resource.netDiskType?.name" class="inline-flex items-center gap-1 mr-2">
            <i :class="resource.netDiskType.icon || 'fa-solid fa-cloud'"></i>{{ resource.netDiskType.name }}
          </span>
          类型：{{ resource.type?.name || '未知' }}
          <span v-if="resource.extractCode" class="ml-2">提取密码：{{ resource.extractCode }}</span>
        </p>
        <div
          v-if="resource.healthStatus && resource.healthStatus !== 'AVAILABLE'"
          class="mb-6 px-3 py-2 rounded-lg text-xs"
          :class="resourceHealthClass(resource.healthStatus)"
        >
          <i class="fa-solid fa-triangle-exclamation mr-1"></i>
          该资源状态：{{ resourceHealthLabel(resource.healthStatus) }}
          <template v-if="resource.issueCount">，已有 {{ resource.issueCount }} 次可用性反馈</template>
        </div>

        <div class="space-y-3">
          <!-- 未登录访客（always_show 模式）：显示登录按钮 -->
          <template v-if="downloadData?.requireLogin">
            <p class="text-sm text-gray-500 mb-1">登录后即可下载此资源</p>
            <NuxtLink
              :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`"
              class="w-full px-6 py-3 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 transition flex items-center justify-center gap-2"
            >
              <i class="fa-solid fa-right-to-bracket"></i>
              登录后下载
            </NuxtLink>
          </template>
          <template v-else>
            <div v-if="countdown > 0" class="text-gray-500">
              <span class="text-2xl font-bold text-gray-800 dark:text-white">{{ countdown }}</span>
              <span class="text-sm ml-1">秒后可下载</span>
            </div>
            <button
              v-else
              @click="handleDownload"
              :disabled="downloading"
              class="w-full px-6 py-3 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 transition disabled:opacity-50"
            >
              <i class="fa-solid fa-download mr-2"></i>
              {{ downloading ? '跳转中...' : '立即下载' }}
            </button>
          </template>
        </div>

        <p class="text-xs text-gray-400 mt-6">
          下载即表示您同意遵守相关版权法规，仅供学习交流使用
        </p>
      </div>
    </div>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [
    // 根据 download_visibility 设置决定是否强制登录
    async function (to) {
      const downloadVisibility = useDownloadVisibility()
      if (downloadVisibility.value === 'login_required') {
        const { status, getSession } = useAuth()
        if (status.value === 'loading') await getSession()
        if (status.value !== 'authenticated') {
          return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
        }
      }
    },
  ],
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: session, status } = useAuth()
const isLoggedIn = computed(() => status.value === 'authenticated')

const resourceId = computed(() => parseInt(route.params.id as string))

// 获取资源信息和下载限制（always_show 模式下访客也能访问）
const { data: downloadData, pending, error } = await useAuthFetch<{
  resource: any
  dailyLimit: number
  todayCount: number
  canDownload: boolean
  requireLogin?: boolean
}>(`/api/download/${resourceId.value}`)

const resource = computed(() => downloadData.value?.resource)
const dailyLimit = computed(() => downloadData.value?.dailyLimit || 10)
const todayCount = computed(() => downloadData.value?.todayCount || 0)
const isUnlimited = computed(() => dailyLimit.value === -1)
const remainingDownloads = computed(() => isUnlimited.value ? Infinity : Math.max(0, dailyLimit.value - todayCount.value))
// requireLogin 为 true 表示未登录访客，不属于"超出限制"情形
const limitReached = computed(() => downloadData.value && !downloadData.value.canDownload && !downloadData.value.requireLogin)

function resourceHealthLabel(status: string): string {
  const map: Record<string, string> = {
    AVAILABLE: '可用',
    NEEDS_REVIEW: '待复查',
    SUSPECTED_BAD: '疑似失效',
    UNAVAILABLE: '已失效',
  }
  return map[status] || status
}

function resourceHealthClass(status: string): string {
  const map: Record<string, string> = {
    NEEDS_REVIEW: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    SUSPECTED_BAD: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    UNAVAILABLE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  }
  return map[status] || 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
}

// 倒计时
const countdown = ref(5)
const downloading = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  document.body.style.overflow = 'hidden'

  // 已登录且可下载时才启动倒计时
  if (downloadData.value?.canDownload && !downloadData.value?.requireLogin) {
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
  document.body.style.overflow = ''
  if (timer) clearInterval(timer)
})

async function handleDownload() {
  if (!resource.value || downloading.value) return

  // 安全检查：确保已登录（always_show 模式下的防御性校验）
  if (!isLoggedIn.value) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }

  downloading.value = true

  try {
    // 记录下载
    const result = await authFetch<{ url: string }>(`/api/download/${resourceId.value}/record`, {
      method: 'POST',
    })

    // 跳转到实际下载链接
    window.open(result.url, '_blank')

    toast.success('下载链接已打开')
  } catch (error: any) {
    toast.error(error.data?.message || '下载失败')
  } finally {
    downloading.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => resource.value
    ? `${resource.value.game?.title || '资源'} 下载 - ${siteName.value}`
    : `下载资源 - ${siteName.value}`
  ),
})
</script>

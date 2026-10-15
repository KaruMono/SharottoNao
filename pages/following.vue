<template>
  <div class="max-w-3xl mx-auto px-2.5 sm:px-4 md:px-6 py-6">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-xl md:text-2xl font-bold">关注动态</h1>
      <span v-if="total > 0" class="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-500">{{ total }}</span>
    </div>

    <!-- 未登录 -->
    <div v-if="!isLoggedIn" class="bg-white dark:bg-zinc-800 rounded-xl p-12 text-center shadow">
      <Icon name="fa6-solid:users" class="text-4xl text-gray-300 mb-4" />
      <p class="text-gray-500 mb-4">登录后查看你关注的人的动态</p>
      <NuxtLink to="/login" class="px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 transition">
        登录
      </NuxtLink>
    </div>

    <template v-else>
      <!-- 无关注 -->
      <div v-if="!pending && items.length === 0 && !hasMore" class="bg-white dark:bg-zinc-800 rounded-xl p-12 text-center shadow">
        <Icon name="fa6-solid:user-group" class="text-4xl text-gray-300 mb-4" />
        <p class="text-gray-500 mb-1">暂无动态</p>
        <p class="text-sm text-gray-400">去关注一些用户，这里会显示他们的最新动态</p>
      </div>

      <!-- 动态列表 -->
      <div v-else class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow flex items-start gap-3"
        >
          <!-- 头像 -->
          <NuxtLink :to="`/user/${item.user.id}`" class="flex-shrink-0">
            <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
              <img v-if="item.user.avatar" :src="item.user.avatar" class="w-full h-full object-cover" />
              <Icon name="fa6-solid:user" class="text-gray-400 text-sm flex items-center justify-center h-full w-full" v-else />
            </div>
          </NuxtLink>

          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap text-sm">
              <NuxtLink :to="`/user/${item.user.id}`" class="font-medium hover:underline">
                {{ item.user.username }}
              </NuxtLink>
              <span class="text-gray-500">{{ activityLabel(item.type) }}</span>
              <NuxtLink
                v-if="item.targetType === 'game' && item.targetId"
                :to="`/games/${item.targetId}`"
                class="font-medium text-gray-800 dark:text-gray-200 hover:underline truncate max-w-[200px]"
              >
                {{ (item.meta as any)?.gameTitle || `游戏 #${item.targetId}` }}
              </NuxtLink>
              <NuxtLink
                v-else-if="item.targetType === 'guide' && item.targetId"
                :to="`/games/${(item.meta as any)?.gameId}`"
                class="font-medium text-gray-800 dark:text-gray-200 hover:underline truncate max-w-[200px]"
              >
                {{ (item.meta as any)?.guideTitle || '攻略' }}
              </NuxtLink>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ formatTime(item.createdAt) }}</p>
          </div>

          <!-- 游戏封面缩略图 -->
          <NuxtLink
            v-if="item.targetType === 'game' && (item.meta as any)?.gameCover"
            :to="`/games/${item.targetId}`"
            class="flex-shrink-0"
          >
            <img
              :src="(item.meta as any).gameCover"
              class="w-10 h-14 object-cover rounded-lg"
            />
          </NuxtLink>

          <!-- 活动类型图标 -->
          <div
            v-else
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            :class="{
              'bg-blue-100 text-blue-500 dark:bg-blue-900/30': item.type === 'CREATE_GAME',
              'bg-green-100 text-green-500 dark:bg-green-900/30': item.type === 'EDIT_GAME',
              'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/30': item.type === 'COMMENT',
              'bg-purple-100 text-purple-500 dark:bg-purple-900/30': ['CREATE_GUIDE','EDIT_GUIDE'].includes(item.type),
              'bg-red-100 text-red-500 dark:bg-red-900/30': item.type === 'FAVORITE_GAME',
              'bg-orange-100 text-orange-500 dark:bg-orange-900/30': item.type === 'RATE_GAME',
            }"
          >
            <FaIcon :icon="activityIcon(item.type)" />
          </div>
        </div>
      </div>

        <!-- 加载中骨架 -->
        <div v-if="pending" class="space-y-3">
          <div v-for="i in 5" :key="i" class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow flex items-start gap-3 animate-pulse">
            <div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-zinc-700 flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3"></div>
              <div class="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/4"></div>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore && !pending" class="flex justify-center pt-2">
          <button
            class="px-6 py-2 rounded-lg border dark:border-zinc-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            @click="loadMore"
          >
            加载更多
          </button>
        </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'require-auth' })

const { status, data: session, token } = useAuth()
const isLoggedIn = computed(() => {
  if (status.value === 'authenticated') return true
  if (status.value === 'loading') return !!token.value
  return false
})

const page = ref(1)
const items = ref<any[]>([])
const total = ref(0)
const hasMore = ref(false)
const pending = ref(false)

const { authFetch } = useAuthRequest()

async function fetchActivities(pageNum: number) {
  pending.value = true
  try {
    const data = await authFetch<any>(`/api/activity/following?page=${pageNum}&limit=30`)
    if (pageNum === 1) {
      items.value = data?.items || []
    } else {
      items.value.push(...(data?.items || []))
    }
    total.value = data?.pagination?.total || 0
    hasMore.value = pageNum < (data?.pagination?.totalPages || 1)
  } catch {
    items.value = []
  } finally {
    pending.value = false
  }
}

async function loadMore() {
  page.value++
  await fetchActivities(page.value)
}

// 首屏数据用 useAsyncData 加载，避免 SSR + 客户端双重请求
const { data: firstPageData } = await useAsyncData(
  'following-feed',
  () => isLoggedIn.value
    ? authFetch<any>('/api/activity/following?page=1&limit=30')
    : Promise.resolve(null),
)

watch(firstPageData, (data) => {
  if (!data) return
  items.value = data?.items || []
  total.value = data?.pagination?.total || 0
  hasMore.value = 1 < (data?.pagination?.totalPages || 1)
}, { immediate: true })

function activityLabel(type: string) {
  const map: Record<string, string> = {
    CREATE_GAME: '创建了游戏',
    EDIT_GAME: '编辑了游戏',
    COMMENT: '评论了',
    CREATE_GUIDE: '发布了攻略',
    EDIT_GUIDE: '更新了攻略',
    RATE_GAME: '评分了',
    FAVORITE_GAME: '收藏了',
  }
  return map[type] || type
}

function activityIcon(type: string) {
  const map: Record<string, string> = {
    CREATE_GAME: 'fa6-solid:plus',
    EDIT_GAME: 'fa6-solid:pen',
    COMMENT: 'fa6-solid:comment',
    CREATE_GUIDE: 'fa6-solid:book',
    EDIT_GUIDE: 'fa6-solid:book',
    FAVORITE_GAME: 'fa6-solid:heart',
    RATE_GAME: 'fa6-solid:star',
  }
  return map[type] || 'fa6-solid:bell'
}

function formatTime(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const siteName = useSiteName()
useHead({
  title: computed(() => `关注动态 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

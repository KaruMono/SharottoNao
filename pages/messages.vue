<template>
  <div class="max-w-3xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="flex items-center justify-between mb-4 md:mb-6">
      <h1 class="text-xl md:text-2xl font-bold">通知中心</h1>
      <div class="flex items-center gap-2 md:gap-3">
        <span v-if="messagesData?.unreadCount" class="text-xs md:text-sm text-gray-500">
          {{ messagesData.unreadCount }} 条未读
        </span>
        <button 
          v-if="messagesData?.unreadCount"
          @click="markAllAsRead"
          class="text-xs md:text-sm text-blue-500 hover:text-blue-600"
        >
          全部已读
        </button>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow mb-4 md:mb-6 overflow-hidden">
      <div class="relative flex border-b dark:border-zinc-700 overflow-x-auto">
        <!-- 滑动指示条 -->
        <div 
          class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
          :style="{
            width: `${100 / filterTabs.length}%`,
            left: `${filterTabs.findIndex(t => t.key === filterType) * (100 / filterTabs.length)}%`
          }"
        ></div>
        <button 
          v-for="tab in filterTabs"
          :key="tab.key"
          @click="filterType = tab.key"
          class="flex-1 min-w-[80px] px-2 md:px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 transition relative z-10 whitespace-nowrap"
          :class="filterType === tab.key 
            ? 'text-gray-800 dark:text-white' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          <i :class="tab.icon"></i>
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-2 md:space-y-3">
      <div 
        v-for="message in messagesData?.items" 
        :key="message.id"
        class="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-5 shadow cursor-pointer hover:shadow-lg transition group"
        :class="{ 'opacity-60': message.isRead }"
        @click="handleMessageClick(message)"
      >
        <div class="flex items-start gap-3 md:gap-4">
          <div 
            class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0"
            :class="getMessageIconBg(message.type)"
          >
            <i :class="getMessageIcon(message.type)" class="text-white text-xs md:text-base"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span 
                class="px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded"
                :class="getMessageTypeBadge(message.type)"
              >
                {{ getMessageTypeLabel(message.type) }}
              </span>
              <span v-if="!message.isRead" class="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span class="text-[10px] md:text-xs text-gray-400 ml-auto">{{ formatDate(message.createdAt) }}</span>
            </div>
            <h3 class="font-medium mt-1.5 md:mt-2 text-sm md:text-base">{{ message.title }}</h3>
            <p class="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {{ message.content }}
            </p>
            <div v-if="message.relatedUrl" class="mt-2">
              <NuxtLink 
                :to="message.relatedUrl"
                class="text-xs text-blue-500 hover:underline"
                @click.stop
              >
                查看详情 <i class="fa-solid fa-arrow-right ml-1"></i>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!messagesData?.items?.length" class="text-center text-gray-500 py-16">
      <i class="fa-solid fa-bell-slash text-4xl mb-4"></i>
      <p>暂无{{ filterType ? filterTabs.find(t => t.key === filterType)?.label : '' }}消息</p>
    </div>

    <Pagination 
      v-if="messagesData && messagesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="messagesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-10"
    />
  </div>
</template>

<script setup lang="ts">
import type { MessageItem, MessagesResponse } from '~/types/api'

definePageMeta({
  middleware: 'require-auth',
})

const route = useRoute()
const router = useRouter()
const { formatDate } = useFormatDate()
const { authFetch } = useAuthRequest()
const toast = useToast()
const globalUnreadCount = useState<number>('unreadMessagesCount', () => 0)

function setUnreadCount(count: number) {
  globalUnreadCount.value = Math.max(0, count)
}

function decrementUnreadCount(step = 1) {
  setUnreadCount(globalUnreadCount.value - step)
}

const currentPage = ref(parseInt(route.query.page as string) || 1)
const filterType = ref(route.query.type as string || '')

// 筛选标签
const filterTabs = [
  { key: '', label: '全部通知', icon: 'fa-solid fa-bell' },
  { key: 'SYSTEM', label: '系统通知', icon: 'fa-solid fa-robot' },
  { key: 'COMMENT_REPLY', label: '评论回复', icon: 'fa-solid fa-reply' },
  { key: 'COMMENT_LIKE', label: '评论点赞', icon: 'fa-solid fa-heart' },
]

const { data: messagesData, refresh } = await useAuthFetch<MessagesResponse>('/api/user/messages', {
  key: 'user-messages',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    type: filterType.value || undefined,
  })),
})

watch(
  () => messagesData.value?.unreadCount,
  (count) => {
    if (typeof count === 'number') setUnreadCount(count)
  },
  { immediate: true },
)

// 监听筛选变化
watch(filterType, (newType) => {
  currentPage.value = 1
  router.push({ query: { ...route.query, type: newType || undefined, page: undefined } })
})

async function markAsRead(message: MessageItem) {
  if (message.isRead) return
  message.isRead = true
  if (messagesData.value?.unreadCount) {
    messagesData.value.unreadCount = Math.max(0, messagesData.value.unreadCount - 1)
  }
  decrementUnreadCount()
  try {
    await authFetch(`/api/user/messages/${message.id}`, { method: 'PUT' })
    await refresh()
  } catch {
    // 忽略错误
  }
}

async function markAllAsRead() {
  const previousItems = messagesData.value?.items?.map(message => ({ message, isRead: message.isRead })) || []
  const previousUnreadCount = messagesData.value?.unreadCount || 0
  if (messagesData.value) {
    messagesData.value.unreadCount = 0
    messagesData.value.items?.forEach(message => {
      message.isRead = true
    })
  }
  setUnreadCount(0)
  try {
    await authFetch('/api/user/messages/read-all', { method: 'POST' })
    await refresh()
    toast.success('已全部标记为已读')
  } catch {
    if (messagesData.value) {
      messagesData.value.unreadCount = previousUnreadCount
      previousItems.forEach(({ message, isRead }) => {
        message.isRead = isRead
      })
    }
    setUnreadCount(previousUnreadCount)
    toast.error('操作失败')
  }
}

function handleMessageClick(message: MessageItem) {
  markAsRead(message)
  if (message.relatedUrl) {
    router.push(message.relatedUrl)
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({ query: { ...route.query, page } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getMessageIcon(type: string) {
  const icons: Record<string, string> = {
    SYSTEM: 'fa-solid fa-robot',
    COMMENT_REPLY: 'fa-solid fa-reply',
    COMMENT_LIKE: 'fa-solid fa-heart',
    OTHER: 'fa-solid fa-bell',
  }
  return icons[type] || icons.OTHER
}

function getMessageIconBg(type: string) {
  const bgs: Record<string, string> = {
    SYSTEM: 'bg-blue-500',
    COMMENT_REPLY: 'bg-green-500',
    COMMENT_LIKE: 'bg-red-500',
    OTHER: 'bg-gray-500',
  }
  return bgs[type] || bgs.OTHER
}

function getMessageTypeBadge(type: string) {
  const badges: Record<string, string> = {
    SYSTEM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    COMMENT_REPLY: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    COMMENT_LIKE: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }
  return badges[type] || badges.OTHER
}

function getMessageTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SYSTEM: '系统',
    COMMENT_REPLY: '回复',
    COMMENT_LIKE: '点赞',
    OTHER: '其他',
  }
  return labels[type] || labels.OTHER
}

const siteName = useSiteName()
useHead({
  title: computed(() => `通知中心 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

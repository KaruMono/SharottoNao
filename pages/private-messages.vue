<template>
  <div class="max-w-6xl mx-auto px-0 sm:px-4 md:px-6">
    <div class="h-[calc(100vh-8.5rem)] min-h-[560px] overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm flex">
      <aside
        class="w-full md:w-80 lg:w-88 shrink-0 border-r border-gray-200 dark:border-zinc-700 flex-col bg-gray-50/80 dark:bg-zinc-900"
        :class="selectedConversationId ? 'hidden md:flex' : 'flex'"
      >
        <div class="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <h1 class="text-lg font-semibold">私信</h1>
          <button
            type="button"
            class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            :disabled="loadingConversations"
            title="刷新"
            @click="loadConversations"
          >
            <i class="fa-solid fa-rotate-right text-sm" :class="{ 'fa-spin': loadingConversations }"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            type="button"
            class="w-full px-3 py-3 flex items-center gap-3 text-left transition border-b border-gray-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800"
            :class="selectedConversationId === conversation.id ? 'bg-white dark:bg-zinc-800' : ''"
            @click="selectConversation(conversation.id)"
          >
            <div class="relative w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
              <img v-if="conversation.participant.avatar" :src="conversation.participant.avatar" class="w-full h-full object-cover" />
              <i v-else class="fa-solid fa-user text-gray-400"></i>
              <span
                v-if="conversation.unreadCount"
                class="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] leading-5 text-center"
              >
                {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ conversation.participant.username }}</span>
                <span
                  v-if="conversation.participant.role !== 'USER'"
                  class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px]"
                  :class="conversation.participant.role === 'ADMIN'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'"
                >
                  {{ roleLabel(conversation.participant.role) }}
                </span>
                <span class="ml-auto shrink-0 text-[11px] text-gray-400">
                  {{ formatShortTime(conversation.lastMessage?.createdAt || conversation.updatedAt) }}
                </span>
              </div>
              <div class="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 min-w-0">
                <i
                  v-if="conversation.lastMessage?.senderId === currentUser?.id && conversation.lastMessage?.readAt"
                  class="fa-solid fa-check text-[11px] text-gray-800 dark:text-gray-200 shrink-0"
                ></i>
                <span class="truncate">{{ lastMessagePreview(conversation.lastMessage) }}</span>
              </div>
            </div>
          </button>

          <div v-if="!conversations.length && !loadingConversations" class="h-full flex flex-col items-center justify-center text-gray-400 py-16">
            <i class="fa-solid fa-message text-4xl mb-3"></i>
            <p class="text-sm">暂无私信</p>
          </div>
        </div>
      </aside>

      <section
        class="flex-1 min-w-0 flex-col bg-gray-100 dark:bg-zinc-950"
        :class="selectedConversationId ? 'flex' : 'hidden md:flex'"
      >
        <template v-if="activeConversation">
          <div class="h-16 px-3 md:px-5 flex items-center gap-3 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <button
              type="button"
              class="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              title="返回"
              @click="closeMobileChat"
            >
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <NuxtLink
              :to="`/user/${activeConversation.participant.id}`"
              class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center shrink-0"
            >
              <img v-if="activeConversation.participant.avatar" :src="activeConversation.participant.avatar" class="w-full h-full object-cover" />
              <i v-else class="fa-solid fa-user text-gray-400"></i>
            </NuxtLink>
            <div class="min-w-0">
              <NuxtLink :to="`/user/${activeConversation.participant.id}`" class="font-semibold hover:underline truncate block">
                {{ activeConversation.participant.username }}
              </NuxtLink>
              <div class="text-xs text-gray-500">{{ roleLabel(activeConversation.participant.role) }}</div>
            </div>
          </div>

          <div ref="messagePane" class="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-3">
            <template v-for="(message, index) in messages" :key="message.id">
              <div v-if="shouldShowDateDivider(message, index)" class="flex justify-center my-3">
                <span class="px-3 py-1 rounded-full bg-white/90 dark:bg-zinc-800/90 text-xs text-gray-500 shadow-sm">
                  {{ formatDividerDate(message.createdAt) }}
                </span>
              </div>

              <div class="flex" :class="message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'">
                <div
                  class="max-w-[78%] md:max-w-[68%] flex flex-col"
                  :class="message.senderId === currentUser?.id ? 'items-end' : 'items-start'"
                >
                  <div
                    class="px-3.5 py-2.5 rounded-2xl shadow-sm"
                    :class="message.senderId === currentUser?.id
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-br-md'
                      : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-bl-md'"
                  >
                    <p v-if="message.type === 'TEXT'" class="text-sm whitespace-pre-wrap break-words">{{ message.content }}</p>
                    <button v-else type="button" class="block overflow-hidden rounded-xl" @click="previewImage = message.imageUrl || ''">
                      <img :src="message.imageUrl || ''" class="max-h-72 max-w-full object-contain" />
                    </button>
                  </div>
                  <div
                    class="mt-1 px-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
                    :class="message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'"
                  >
                    <span>{{ formatMessageTime(message.createdAt) }}</span>
                    <i
                      v-if="message.senderId === currentUser?.id && message.readAt"
                      class="fa-solid fa-check text-[10px] text-gray-700 dark:text-gray-300"
                    ></i>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <form class="p-3 md:p-4 border-t border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900" @submit.prevent="sendText">
            <div class="flex items-end gap-2">
              <button
                type="button"
                class="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition shrink-0"
                :disabled="sending || uploadingImage"
                title="发送图片"
                @click="imageInput?.click()"
              >
                <i class="fa-solid fa-image"></i>
              </button>
              <textarea
                v-model="draft"
                rows="1"
                class="min-h-10 max-h-32 flex-1 resize-none px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                placeholder="写点什么..."
                @keydown.enter.exact.prevent="sendText"
              ></textarea>
              <button
                type="submit"
                class="w-10 h-10 rounded-xl bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 shrink-0"
                :disabled="sending || uploadingImage || !draft.trim()"
                title="发送"
              >
                <i class="fa-solid fa-paper-plane text-sm"></i>
              </button>
            </div>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageChange" />
          </form>
        </template>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400">
          <i class="fa-regular fa-comments text-5xl mb-3"></i>
          <p class="text-sm">暂无聊天</p>
        </div>
      </section>
    </div>

    <button
      v-if="previewImage"
      type="button"
      class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      @click="previewImage = ''"
    >
      <img :src="previewImage" class="max-w-full max-h-full object-contain" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  PrivateConversationItem,
  PrivateConversationMessagesResponse,
  PrivateConversationsResponse,
  PrivateMessageItem,
} from '~/types/api'

definePageMeta({
  middleware: 'require-auth',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const { data: session } = useAuth()
const toast = useToast()

const currentUser = computed(() => session.value as any)
const conversations = ref<PrivateConversationItem[]>([])
const messages = ref<PrivateMessageItem[]>([])
const selectedConversationId = ref<number | null>(parseNumericQuery(route.query.conversation))
const conversationHeader = ref<PrivateConversationMessagesResponse['conversation'] | null>(null)
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)
const uploadingImage = ref(false)
const draft = ref('')
const previewImage = ref('')
const messagePane = ref<HTMLElement>()
const imageInput = ref<HTMLInputElement>()
const globalPrivateUnreadCount = useState<number>('unreadPrivateMessagesCount', () => 0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const activeConversation = computed(() => {
  if (!selectedConversationId.value) return null
  const fromList = conversations.value.find(item => item.id === selectedConversationId.value)
  if (fromList) return fromList
  if (conversationHeader.value) {
    return {
      id: conversationHeader.value.id,
      participant: conversationHeader.value.participant,
      updatedAt: conversationHeader.value.updatedAt,
      unreadCount: 0,
      lastMessage: null,
    } satisfies PrivateConversationItem
  }
  return null
})

function parseNumericQuery(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const numeric = Number(raw)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

async function loadConversations() {
  loadingConversations.value = true
  try {
    const data = await authFetch<PrivateConversationsResponse>('/api/private-messages/conversations')
    conversations.value = data.items
    globalPrivateUnreadCount.value = data.items.reduce((total, item) => total + item.unreadCount, 0)
  } catch (error: any) {
    toast.error(error.data?.message || '加载私信失败')
  } finally {
    loadingConversations.value = false
  }
}

async function openConversationWithUser(userId: number) {
  try {
    const conversation = await authFetch<{ id: number }>('/api/private-messages/conversations', {
      method: 'POST',
      body: { targetUserId: userId },
    })
    await loadConversations()
    await selectConversation(conversation.id, true)
  } catch (error: any) {
    toast.error(error.data?.message || '无法发起私信')
    await router.replace({ query: {} })
  }
}

async function selectConversation(conversationId: number, replace = false) {
  selectedConversationId.value = conversationId
  const nextQuery = { conversation: String(conversationId) }
  if (replace) await router.replace({ query: nextQuery })
  else await router.push({ query: nextQuery })
  await loadMessages(conversationId)
}

async function loadMessages(conversationId = selectedConversationId.value, silent = false) {
  if (!conversationId) return
  if (!silent) loadingMessages.value = true
  try {
    const data = await authFetch<PrivateConversationMessagesResponse>(`/api/private-messages/conversations/${conversationId}/messages`)
    conversationHeader.value = data.conversation
    messages.value = data.messages
    await loadConversations()
    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    if (!silent) toast.error(error.data?.message || '加载聊天失败')
  } finally {
    loadingMessages.value = false
  }
}

async function sendText() {
  const content = draft.value.trim()
  if (!content || !selectedConversationId.value || sending.value) return

  sending.value = true
  try {
    const message = await authFetch<PrivateMessageItem>(`/api/private-messages/conversations/${selectedConversationId.value}/messages`, {
      method: 'POST',
      body: { type: 'TEXT', content },
    })
    messages.value.push(message)
    draft.value = ''
    await loadConversations()
    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    toast.error(error.data?.message || '发送失败')
  } finally {
    sending.value = false
  }
}

async function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selectedConversationId.value) return

  uploadingImage.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'images')
    const uploaded = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: fd,
    })
    const message = await authFetch<PrivateMessageItem>(`/api/private-messages/conversations/${selectedConversationId.value}/messages`, {
      method: 'POST',
      body: { type: 'IMAGE', imageUrl: uploaded.url },
    })
    messages.value.push(message)
    await loadConversations()
    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    toast.error(error.data?.message || '图片发送失败')
  } finally {
    uploadingImage.value = false
    input.value = ''
  }
}

function closeMobileChat() {
  selectedConversationId.value = null
  messages.value = []
  conversationHeader.value = null
  router.replace({ query: {} })
}

function scrollToBottom() {
  if (!messagePane.value) return
  messagePane.value.scrollTop = messagePane.value.scrollHeight
}

function lastMessagePreview(message?: PrivateMessageItem | null) {
  if (!message) return '暂无消息'
  if (message.type === 'IMAGE') return '[图片]'
  return message.content || ''
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    ADMIN: '管理员',
    EDITOR: '编辑',
    USER: '用户',
  }
  return role ? labels[role] || role : ''
}

function formatMessageTime(value?: string | Date | null) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatShortTime(value?: string | Date | null) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return formatMessageTime(date)
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function formatDividerDate(value?: string | Date | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function shouldShowDateDivider(message: PrivateMessageItem, index: number) {
  const currentDate = new Date(message.createdAt)
  if (Date.now() - currentDate.getTime() < 24 * 60 * 60 * 1000) return false
  if (index === 0) return true

  const previous = messages.value[index - 1]
  return new Date(previous.createdAt).toDateString() !== currentDate.toDateString()
}

onMounted(async () => {
  await loadConversations()
  const targetUserId = parseNumericQuery(route.query.user)
  if (targetUserId) {
    await openConversationWithUser(targetUserId)
  } else if (selectedConversationId.value) {
    await loadMessages(selectedConversationId.value)
  }

  refreshTimer = setInterval(async () => {
    await loadConversations()
    if (selectedConversationId.value) {
      await loadMessages(selectedConversationId.value, true)
    }
  }, 10000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

watch(
  () => route.query.conversation,
  async (value) => {
    const conversationId = parseNumericQuery(value)
    if (conversationId && conversationId !== selectedConversationId.value) {
      selectedConversationId.value = conversationId
      await loadMessages(conversationId)
    }
  },
)

const siteName = useSiteName()
useHead({
  title: computed(() => `私信 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

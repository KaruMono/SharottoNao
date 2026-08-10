<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div v-if="userData" class="space-y-4 md:space-y-8">
      <!-- 用户信息卡片 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 md:p-6 shadow">
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-5">
          <div class="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="userData.user.avatar" :src="userData.user.avatar" class="w-full h-full object-cover" />
            <i v-else class="fa-solid fa-user text-xl md:text-2xl text-gray-400"></i>
          </div>
          <div class="flex-1 text-center sm:text-left">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 class="text-xl md:text-2xl font-bold">{{ userData.user.username }}</h1>
              <span
                v-if="userData.user.role !== 'USER'"
                class="px-2 py-0.5 text-xs rounded font-medium"
                :class="userData.user.role === 'ADMIN' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'"
              >
                {{ userData.user.role === 'ADMIN' ? '管理员' : '编辑' }}
              </span>
              <span
                v-if="(userData.user as any).title"
                class="px-2 py-0.5 text-xs rounded font-medium border"
                :style="{ color: (userData.user as any).titleColor || '#6366f1', borderColor: (userData.user as any).titleColor || '#6366f1' }"
              >{{ (userData.user as any).title }}</span>
            </div>
            <p v-if="userData.user.bio" class="text-gray-500 dark:text-gray-400 mt-1 text-sm">{{ userData.user.bio }}</p>
            <p class="text-xs text-gray-400 mt-2">
              <i class="fa-solid fa-calendar-days mr-1"></i>
              {{ new Date(userData.user.createdAt).toLocaleDateString('zh-CN') }} 加入
            </p>
          </div>
          
          <!-- 关注按钮 -->
          <div v-if="isLoggedIn && userData.user.id !== currentUser?.id" class="sm:ml-auto flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <button
              @click="goPrivateMessage"
              :disabled="privateMessageLoading || !canPrivateMessage"
              class="px-4 py-2 rounded-lg text-sm transition border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :title="canPrivateMessage ? '发送私信' : '该用户当前不可私信'"
            >
              <i class="fa-solid fa-envelope mr-1.5"></i>
              私信
            </button>
            <button 
              @click="toggleFollow"
              :disabled="followLoading"
              class="px-4 py-2 rounded-lg text-sm transition"
              :class="isFollowing 
                ? 'border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700' 
                : 'bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500'"
            >
              <i :class="isFollowing ? 'fa-solid fa-user-check' : 'fa-solid fa-user-plus'" class="mr-1.5"></i>
              {{ isFollowing ? '已关注' : '关注' }}
            </button>
          </div>
        </div>

        <!-- 统计数据 -->
        <div class="grid grid-cols-4 md:grid-cols-8 gap-2 mt-4 md:mt-6 pt-4 md:pt-6 border-t dark:border-zinc-700">
          <button 
            @click="showFollowersModal = true"
            class="text-center hover:bg-gray-50 dark:hover:bg-zinc-700/50 px-1 md:px-2 py-2 rounded-lg transition"
          >
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.followers || 0 }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">粉丝</div>
          </button>
          <button 
            @click="showFollowingModal = true"
            class="text-center hover:bg-gray-50 dark:hover:bg-zinc-700/50 px-1 md:px-2 py-2 rounded-lg transition"
          >
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.following || 0 }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">关注</div>
          </button>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.createdGames }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">创建</div>
          </div>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.favorites }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">收藏</div>
          </div>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.contentEdits }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">编辑</div>
          </div>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.comments }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">评论</div>
          </div>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.resources }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">资源</div>
          </div>
          <div class="text-center px-1 md:px-2 py-2">
            <div class="text-lg md:text-xl font-bold">{{ userData.user._count.guides }}</div>
            <div class="text-[10px] md:text-xs text-gray-500">攻略</div>
          </div>
        </div>
      </div>

      <!-- 标签页切换 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="relative flex border-b border-gray-200 dark:border-zinc-700">
          <div 
            class="absolute bottom-0 h-0.5 bg-gray-800 dark:bg-white transition-all duration-300 ease-out"
            :style="{
              width: `${100 / 3}%`,
              left: `${['favorites', 'comments', 'created'].indexOf(activeTab) * 100 / 3}%`
            }"
          ></div>
          <button 
            @click="activeTab = 'favorites'"
            class="flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 transition relative z-10"
            :class="activeTab === 'favorites' ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
          >
            <i class="fa-solid fa-heart"></i><span class="hidden sm:inline">收藏</span>
          </button>
          <button 
            @click="activeTab = 'comments'"
            class="flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 transition relative z-10"
            :class="activeTab === 'comments' ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
          >
            <i class="fa-solid fa-comments"></i><span class="hidden sm:inline">评论</span>
          </button>
          <button 
            @click="activeTab = 'created'"
            class="flex-1 px-2 md:px-4 py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 transition relative z-10"
            :class="activeTab === 'created' ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
          >
            <i class="fa-solid fa-gamepad"></i><span class="hidden sm:inline">创建</span>
          </button>
        </div>

        <div class="p-3 md:p-5">
          <!-- 收藏的游戏 -->
          <div v-if="activeTab === 'favorites'">
            <div v-if="userData.recentFavorites.length" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
              <GameCard 
                v-for="game in userData.recentFavorites" 
                :key="game.id" 
                :game="game" 
              />
            </div>
            <div v-else class="text-center text-gray-500 py-8">暂无收藏</div>
          </div>

          <!-- 最近评论 -->
          <div v-if="activeTab === 'comments'">
            <div v-if="userData.recentComments.length" class="space-y-3 md:space-y-4">
              <div 
                v-for="comment in userData.recentComments" 
                :key="comment.id"
                class="border-b dark:border-zinc-700 pb-3 md:pb-4 last:border-0"
              >
                <NuxtLink :to="`/games/${comment.game.id}`" class="text-sm font-medium hover:underline">
                  {{ comment.game.title }}
                </NuxtLink>
                <SafeHtml class="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2" :content="comment.content" />
                <div class="text-xs text-gray-400 mt-1">{{ new Date(comment.createdAt).toLocaleDateString('zh-CN') }}</div>
              </div>
            </div>
            <div v-else class="text-center text-gray-500 py-8">暂无评论</div>
          </div>

          <!-- 创建的条目 -->
          <div v-if="activeTab === 'created'">
            <div v-if="userData.createdGames.length" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
              <GameCard 
                v-for="game in userData.createdGames" 
                :key="game.id" 
                :game="game" 
              />
            </div>
            <div v-else class="text-center text-gray-500 py-8">暂无创建的条目</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="pending" class="text-center py-20">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
    </div>

    <!-- 错误 -->
    <div v-else class="text-center py-20">
      <i class="fa-solid fa-user-slash text-4xl text-gray-400 mb-4"></i>
      <p class="text-gray-500">{{ error?.message || '用户不存在' }}</p>
    </div>
    
    <!-- 粉丝列表弹窗 -->
    <Modal v-model="showFollowersModal" title="粉丝">
      <div v-if="followersLoading" class="text-center py-8">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      <div v-else-if="followersList.length" class="space-y-3 max-h-96 overflow-y-auto">
        <NuxtLink 
          v-for="user in followersList" 
          :key="user.id"
          :to="`/user/${user.id}`"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          @click="showFollowersModal = false"
        >
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
            <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" loading="lazy" />
            <i v-else class="fa-solid fa-user text-gray-400"></i>
          </div>
          <div>
            <div class="font-medium">{{ user.username }}</div>
            <div v-if="user.bio" class="text-xs text-gray-500 line-clamp-1">{{ user.bio }}</div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="text-center text-gray-500 py-8">暂无粉丝</div>
    </Modal>
    
    <!-- 关注列表弹窗 -->
    <Modal v-model="showFollowingModal" title="关注">
      <div v-if="followingLoading" class="text-center py-8">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      <div v-else-if="followingList.length" class="space-y-3 max-h-96 overflow-y-auto">
        <NuxtLink 
          v-for="user in followingList" 
          :key="user.id"
          :to="`/user/${user.id}`"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          @click="showFollowingModal = false"
        >
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
            <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" loading="lazy" />
            <i v-else class="fa-solid fa-user text-gray-400"></i>
          </div>
          <div>
            <div class="font-medium">{{ user.username }}</div>
            <div v-if="user.bio" class="text-xs text-gray-500 line-clamp-1">{{ user.bio }}</div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="text-center text-gray-500 py-8">暂无关注</div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { ListResponse, PublicUserResponse, UserSummary } from '~/types/api'

const route = useRoute()
const router = useRouter()
const { data: session, status, token } = useAuth()
const { authFetch } = useAuthRequest()
const toast = useToast()

const userId = computed(() => route.params.id as string)
const activeTab = ref('favorites')

// 在 loading 状态时，如果有 token 则保持登录状态，避免切换标签页时闪烁
const isLoggedIn = computed(() => {
  if (status.value === 'authenticated') return true
  if (status.value === 'loading') return !!token.value
  return false
})
const currentUser = computed(() => session.value as any)

const { data: userData, pending, error, refresh } = await useFetch<PublicUserResponse>(`/api/user/${userId.value}`, { key: `user-${userId.value}` })

// 关注状态
const isFollowing = ref(false)
const followLoading = ref(false)
const canPrivateMessage = ref(false)
const privateMessageLoading = ref(false)

// 粉丝/关注列表弹窗
const showFollowersModal = ref(false)
const showFollowingModal = ref(false)
const followersList = ref<UserSummary[]>([])
const followingList = ref<UserSummary[]>([])
const followersLoading = ref(false)
const followingLoading = ref(false)

// 检查是否已关注
async function checkFollowStatus() {
  if (!isLoggedIn.value || !userData.value) return
  
  try {
    const following = await $fetch<ListResponse<UserSummary>>(`/api/user/${currentUser.value.id}/following`, {
      params: { limit: 100 },
    })
    isFollowing.value = following.items.some(u => u.id === parseInt(userId.value))
  } catch {
    // 忽略错误
  }
}

async function checkPrivateMessagePermission() {
  if (!isLoggedIn.value || !userData.value || userData.value.user.id === currentUser.value?.id) return

  privateMessageLoading.value = true
  try {
    const data = await authFetch<{ canSendToTarget: boolean }>('/api/private-messages/permissions', {
      query: { targetUserId: userData.value.user.id },
    })
    canPrivateMessage.value = data.canSendToTarget
  } catch {
    canPrivateMessage.value = false
  } finally {
    privateMessageLoading.value = false
  }
}

function goPrivateMessage() {
  if (!userData.value) return
  if (!canPrivateMessage.value) {
    toast.error('当前用户只能私信管理员或编辑')
    return
  }
  router.push({
    path: '/private-messages',
    query: { user: String(userData.value.user.id) },
  })
}

// 关注/取消关注
async function toggleFollow() {
  if (!isLoggedIn.value || followLoading.value) return
  
  followLoading.value = true
  try {
    const result = await authFetch<{ followed: boolean }>(`/api/user/${userId.value}/follow`, {
      method: 'POST',
    })
    isFollowing.value = result.followed
    toast.success(result.followed ? '关注成功' : '已取消关注')
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    followLoading.value = false
  }
}

// 加载粉丝列表
async function loadFollowers() {
  followersLoading.value = true
  try {
    const data = await $fetch<ListResponse<UserSummary>>(`/api/user/${userId.value}/followers`)
    followersList.value = data.items
  } catch {
    followersList.value = []
  } finally {
    followersLoading.value = false
  }
}

// 加载关注列表
async function loadFollowing() {
  followingLoading.value = true
  try {
    const data = await $fetch<ListResponse<UserSummary>>(`/api/user/${userId.value}/following`)
    followingList.value = data.items
  } catch {
    followingList.value = []
  } finally {
    followingLoading.value = false
  }
}

// 监听弹窗打开
watch(showFollowersModal, (val) => {
  if (val) loadFollowers()
})

watch(showFollowingModal, (val) => {
  if (val) loadFollowing()
})

// 初始化
onMounted(() => {
  checkFollowStatus()
  checkPrivateMessagePermission()
})

const siteName = useSiteName()
useHead({
  title: computed(() => userData.value ? `${userData.value.user.username} - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    if (!userData.value) return []
    const u = userData.value.user
    const desc = u.bio?.slice(0, 150) || `${u.username} 在 ${siteName.value} 的个人主页。`
    const title = `${u.username} - ${siteName.value}`
    const metas: any[] = [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'profile' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
    if (u.avatar) {
      metas.push({ property: 'og:image', content: u.avatar })
      metas.push({ name: 'twitter:image', content: u.avatar })
    }
    return metas
  }),
})
</script>

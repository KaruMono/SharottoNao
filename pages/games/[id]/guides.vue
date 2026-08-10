<template>
  <div class="max-w-4xl mx-auto px-2.5 sm:px-4 md:px-6">
    <!-- 返回按钮和标题 -->
    <div class="flex items-center justify-between gap-3 mb-6 sm:mb-8">
      <div class="flex items-center gap-2 sm:gap-4 min-w-0">
        <NuxtLink 
          :to="`/games/${gameId}`"
          class="p-2 -ml-2 sm:ml-0 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </NuxtLink>
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold">攻略列表</h1>
          <p v-if="game" class="text-sm text-gray-500 mt-1">{{ game.title }}</p>
        </div>
      </div>
      <button 
        v-if="isLoggedIn"
        @click="openCreateModal"
        class="shrink-0 px-3 sm:px-4 py-2 bg-gray-800 dark:bg-zinc-600 text-white rounded-lg text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 transition flex items-center gap-2"
      >
        <i class="fa-solid fa-plus"></i>发布攻略
      </button>
    </div>

    <!-- 攻略列表 -->
    <div class="space-y-4">
      <div 
        v-for="guide in guides"
        :key="guide.id"
        class="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-5 shadow hover:shadow-lg transition cursor-pointer"
        @click="openGuide(guide)"
      >
        <div class="flex items-start justify-between gap-3 sm:gap-4">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-lg">{{ guide.title }}</h3>
            <SafeHtml tag="p" class="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2" :content="getPreview(guide.content)" />
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-400">
              <span class="flex items-center gap-1">
                <img v-if="guide.user.avatar" :src="guide.user.avatar" class="w-4 h-4 rounded-full" />
                <i v-else class="fa-solid fa-user"></i>
                {{ guide.user.username }}
              </span>
              <span><i class="fa-solid fa-eye mr-1"></i>{{ guide.viewCount }}</span>
              <span>{{ formatDate(guide.createdAt) }}</span>
            </div>
          </div>
          <div v-if="canManageGuide(guide)" class="flex items-center gap-1 shrink-0">
            <button 
              @click.stop="openEditModal(guide)"
              class="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
              title="编辑攻略"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
            <button 
              @click.stop="handleDeleteGuide(guide)"
              class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              title="删除攻略"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>

      <div v-if="!guides?.length" class="text-center py-16 text-gray-500">
        <i class="fa-solid fa-book text-4xl mb-4"></i>
        <p>暂无攻略</p>
        <p v-if="isLoggedIn" class="text-sm mt-2">点击上方按钮发布第一篇攻略</p>
      </div>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="pagination && pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-10"
    />

    <!-- 创建攻略弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
      <div 
        v-if="showGuideModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2.5 sm:p-4"
      >
        <div
          class="bg-white dark:bg-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col modal-content"
          @click.stop
        >
          <div class="p-4 sm:p-6 border-b dark:border-zinc-700">
            <h3 class="font-semibold text-lg dark:text-gray-100">{{ isEditMode ? '编辑攻略' : '发布攻略' }}</h3>
          </div>
          <div class="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2 dark:text-gray-200">标题</label>
              <input 
                v-model="guideForm.title"
                type="text"
                class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="攻略标题"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2 dark:text-gray-200">内容</label>
              <LazyTiptapEditorFull
                v-model="guideForm.content"
                placeholder="写下你的攻略..."
                :min-height="250"
              />
            </div>
          </div>
          <div class="p-4 sm:p-6 border-t dark:border-zinc-700 grid grid-cols-2 sm:flex sm:justify-end gap-2">
            <button 
              @click="closeGuideModal"
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
            >
              取消
            </button>
            <button 
              @click="submitGuide"
              :disabled="!guideForm.title || !guideForm.content || submitting"
              class="px-4 py-2 bg-gray-800 dark:bg-zinc-600 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {{ submitting ? (isEditMode ? '保存中...' : '发布中...') : (isEditMode ? '保存' : '发布') }}
            </button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- 查看攻略弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
      <div 
        v-if="selectedGuide"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2.5 sm:p-4"
      >
        <div
          class="bg-white dark:bg-zinc-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col modal-content"
          @click.stop
        >
          <div class="p-4 sm:p-6 border-b dark:border-zinc-700">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <h3 class="font-semibold text-xl leading-snug break-words">{{ selectedGuide.title }}</h3>
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-500">
                  <NuxtLink
                    :to="`/user/${selectedGuide.user.id}`"
                    class="inline-flex min-w-0 max-w-full items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-300 transition"
                  >
                    <img v-if="selectedGuide.user.avatar" :src="selectedGuide.user.avatar" class="w-4 h-4 rounded-full" />
                    <i v-else class="fa-solid fa-user text-gray-400"></i>
                    <span class="truncate">{{ selectedGuide.user.username }}</span>
                  </NuxtLink>
                  <span class="inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-calendar text-gray-400"></i>{{ formatDate(selectedGuide.createdAt) }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-eye text-gray-400"></i>{{ selectedGuide.viewCount }}
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-heart text-gray-400"></i>{{ selectedGuide.likeCount || 0 }}
                  </span>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-0.5 -mr-2 -mt-2">
                <template v-if="canManageGuide(selectedGuide)">
                  <button
                    @click="openEditModal(selectedGuide)"
                    class="guide-icon-btn hover:text-gray-700 dark:hover:text-gray-300"
                    title="编辑"
                    aria-label="编辑"
                  >
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button
                    @click="handleDeleteGuide(selectedGuide)"
                    class="guide-icon-btn hover:text-red-500"
                    title="删除"
                    aria-label="删除"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </template>
                <button
                  @click="selectedGuide = null"
                  class="guide-icon-btn hover:text-gray-600 dark:hover:text-gray-300"
                  title="关闭"
                  aria-label="关闭"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
          </div>
          <SafeHtml
            ref="guideContentRef"
            class="p-4 sm:p-6 flex-1 overflow-y-auto prose dark:prose-invert max-w-none guide-content"
            :content="selectedGuide.content"
          />
          <div class="p-4 sm:p-6 border-t dark:border-zinc-700 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button
                v-if="isLoggedIn"
                @click="toggleGuideLike(selectedGuide)"
                class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
                :class="selectedGuide.isLiked ? 'text-red-500 border-red-200 dark:border-red-800' : 'text-gray-600 dark:text-gray-300'"
              >
                <i :class="selectedGuide.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
                <span>{{ selectedGuide.likeCount || '点赞' }}</span>
              </button>
              <button
                v-if="isLoggedIn && selectedGuide.user.id !== user?.id"
                @click="openGuideReportModal(selectedGuide)"
                class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition flex items-center justify-center gap-2"
              >
                <i class="fa-solid fa-flag"></i>
                举报
              </button>
            </div>
            <button 
              @click="selectedGuide = null"
              class="px-5 py-2 bg-gray-800 dark:bg-zinc-600 text-white rounded-lg text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 transition"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal">
      <div
        v-if="showReportModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2.5 sm:p-4"
        @click.self="closeReportModal"
      >
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-6 w-full max-w-md shadow-xl modal-content">
          <h3 class="font-semibold mb-4">举报攻略</h3>
          <div class="space-y-3">
            <label class="block text-sm">
              <span class="block text-gray-500 mb-1">举报理由</span>
              <select
                v-model="reportForm.reason"
                class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
              >
                <option value="垃圾广告">垃圾广告</option>
                <option value="违规内容">违规内容</option>
                <option value="恶意剧透">恶意剧透</option>
                <option value="其他">其他</option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="block text-gray-500 mb-1">补充说明</span>
              <textarea
                v-model="reportForm.detail"
                rows="3"
                class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                placeholder="可选"
              ></textarea>
            </label>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button
              @click="closeReportModal"
              class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              取消
            </button>
            <button
              @click="submitGuideReport"
              :disabled="reportSubmitting"
              class="px-4 py-2 bg-gray-800 dark:bg-zinc-600 text-white rounded-lg text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
            >
              {{ reportSubmitting ? '提交中...' : '提交举报' }}
            </button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- 图片灯箱 -->
    <Lightbox
      :show="showLightbox"
      :images="lightboxImages"
      :initial-index="lightboxIndex"
      @close="showLightbox = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { GameDetail, GameGuideItem, GameGuidesResponse } from '~/types/api'

const route = useRoute()
const router = useRouter()
const { formatDate } = useFormatDate()
const { data: session, status, token } = useAuth()
const { authFetch } = useAuthRequest()
const toast = useToast()

const gameId = computed(() => parseInt(route.params.id as string))
const currentPage = ref(parseInt(route.query.page as string) || 1)

const hydrated = ref(false)
onMounted(() => { hydrated.value = true })

const isLoggedIn = computed(() => {
  if (!hydrated.value) return false
  if (status.value === 'authenticated') return true
  if (status.value === 'loading') return !!token.value
  return false
})
const user = computed(() => session.value as any)

// 获取游戏信息（使用独立的 key 避免与详情页缓存冲突）
// 注意：不使用 pick 以避免缓存污染
const { data: gameData } = await useAuthFetch<Pick<GameDetail, 'title'>>(`/api/games/${gameId.value}`, {
  key: `game-guides-${gameId.value}`,
})
const game = computed(() => gameData.value ? { title: gameData.value.title } : null)

// 获取攻略列表
const { data: guidesData, refresh } = await useFetch<GameGuidesResponse>(`/api/games/${gameId.value}/guides`, {
  key: `game-${gameId.value}-guides`,
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
  })),
})

const guides = computed(() => guidesData.value?.items || [])
const pagination = computed(() => guidesData.value?.pagination)

// 创建攻略
const showGuideModal = ref(false)
const submitting = ref(false)
const editingGuideId = ref<number | null>(null)
const guideForm = reactive({
  title: '',
  content: '',
})

// 查看攻略
const selectedGuide = ref<GameGuideItem | null>(null)
const isEditMode = computed(() => editingGuideId.value !== null)
const showReportModal = ref(false)
const reportSubmitting = ref(false)
const reportingGuide = ref<GameGuideItem | null>(null)
const reportForm = reactive({
  reason: '垃圾广告',
  detail: '',
})

// 灯箱
const showLightbox = ref(false)
const lightboxImages = ref<string[]>([])
const lightboxIndex = ref(0)
const guideContentRef = ref<HTMLElement>()

function getPreview(html: string) {
  // 移除HTML标签，截取前100字符
  const text = html.replace(/<[^>]+>/g, '')
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

function canManageGuide(guide: GameGuideItem) {
  return isLoggedIn.value && (guide?.user?.id === user.value?.id || user.value?.role === 'ADMIN')
}

function resetGuideForm() {
  editingGuideId.value = null
  guideForm.title = ''
  guideForm.content = ''
}

function openCreateModal() {
  resetGuideForm()
  showGuideModal.value = true
}

function openEditModal(guide: GameGuideItem) {
  if (!canManageGuide(guide)) return
  if (selectedGuide.value?.id === guide.id) {
    selectedGuide.value = null
  }
  editingGuideId.value = guide.id
  guideForm.title = guide.title
  guideForm.content = guide.content
  showGuideModal.value = true
}

function closeGuideModal() {
  showGuideModal.value = false
  resetGuideForm()
}

function updateGuideState(guideId: number, patch: Partial<GameGuideItem>) {
  const guide = guides.value.find(item => item.id === guideId)
  if (guide) Object.assign(guide, patch)
  if (selectedGuide.value?.id === guideId) {
    selectedGuide.value = { ...selectedGuide.value, ...patch }
  }
}

async function toggleGuideLike(guide: GameGuideItem) {
  if (!isLoggedIn.value) return
  try {
    const res = await authFetch<{ liked: boolean; likeCount: number }>(`/api/guides/${guide.id}/like`, {
      method: 'POST',
    })
    updateGuideState(guide.id, {
      isLiked: res.liked,
      likeCount: res.likeCount,
    })
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  }
}

function openGuideReportModal(guide: GameGuideItem) {
  reportingGuide.value = guide
  reportForm.reason = '垃圾广告'
  reportForm.detail = ''
  showReportModal.value = true
}

function closeReportModal() {
  showReportModal.value = false
  reportingGuide.value = null
}

async function submitGuideReport() {
  if (!reportingGuide.value || reportSubmitting.value) return
  reportSubmitting.value = true
  try {
    await authFetch('/api/reports', {
      method: 'POST',
      body: {
        type: 'GUIDE',
        targetId: reportingGuide.value.id,
        reason: reportForm.reason,
        detail: reportForm.detail || null,
      },
    })
    toast.success('举报已提交')
    closeReportModal()
  } catch (error: any) {
    toast.error(error.data?.message || '举报失败')
  } finally {
    reportSubmitting.value = false
  }
}

async function openGuide(guide: GameGuideItem) {
  // 增加浏览量
  try {
    await $fetch(`/api/guides/${guide.id}/view`, { method: 'POST' })
  } catch {
    // 忽略错误
  }
  selectedGuide.value = guide
  await nextTick()
  bindGuideImages()
}

function bindGuideImages() {
  const container = (guideContentRef.value as any)?.$el ?? guideContentRef.value
  if (!container) return
  const imgs = container.querySelectorAll('img:not(.inline-emoji)')
  imgs.forEach((img: Element) => {
    const el = img as HTMLImageElement
    el.style.cursor = 'pointer'
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const root = (guideContentRef.value as any)?.$el ?? guideContentRef.value
      const allImgs = Array.from(root.querySelectorAll('img:not(.inline-emoji)')) as HTMLImageElement[]
      lightboxImages.value = allImgs.map(i => i.src)
      lightboxIndex.value = allImgs.indexOf(el)
      showLightbox.value = true
    })
  })
}

async function submitGuide() {
  if (!guideForm.title || !guideForm.content) return
  
  submitting.value = true
  try {
    const isEditing = isEditMode.value
    const savedGuide = await authFetch<Partial<GameGuideItem>>(isEditing ? `/api/guides/${editingGuideId.value}` : `/api/games/${gameId.value}/guides`, {
      method: isEditing ? 'PUT' : 'POST',
      body: guideForm,
    })
    toast.success(isEditing ? '攻略更新成功' : '攻略发布成功')
    if (selectedGuide.value && isEditing) {
      selectedGuide.value = {
        ...selectedGuide.value,
        ...savedGuide,
      }
    }
    closeGuideModal()
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || (isEditMode.value ? '更新失败' : '发布失败'))
  } finally {
    submitting.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({
    query: { ...route.query, page: page > 1 ? page : undefined },
  })
}

async function handleDeleteGuide(guide: GameGuideItem) {
  if (!confirm('确定要删除这篇攻略吗？此操作无法撤销。')) return
  
  try {
    await authFetch(`/api/guides/${guide.id}`, { method: 'DELETE' })
    toast.success('攻略已删除')
    if (selectedGuide.value?.id === guide.id) {
      selectedGuide.value = null
    }
    await refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => game.value ? `${game.value.title} 攻略 - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    if (!game.value) return []
    const desc = `${game.value.title} 攻略合集，含 ${guides.value?.length || 0} 篇玩家分享的通关指南与心得。`
    const title = `${game.value.title} 攻略 - ${siteName.value}`
    const metas: any[] = [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: game.value.coverImage ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
    if (game.value.coverImage) {
      metas.push({ property: 'og:image', content: game.value.coverImage })
      metas.push({ name: 'twitter:image', content: game.value.coverImage })
    }
    return metas
  }),
})
</script>

<style scoped>
.guide-icon-btn {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: rgb(156, 163, 175);
  transition: color 0.15s ease, background-color 0.15s ease;
}

.guide-icon-btn:hover {
  background-color: rgb(243, 244, 246);
}

:global(.dark) .guide-icon-btn:hover {
  background-color: rgb(63, 63, 70);
}

/* 所有段落保证最小高度，空段落也能显示为可见的空行 */
.guide-content :deep(p) {
  min-height: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* 第一个段落不需要上边距 */
.guide-content :deep(p:first-child) {
  margin-top: 0;
}

/* 最后一个段落不需要下边距 */
.guide-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>

<template>
  <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-medium flex items-center gap-2">
        <Icon name="fa6-solid:comments" class="text-gray-400" />评论 ({{ totalComments }})
      </h2>
      <!-- 评论排序 -->
      <div v-if="totalComments > 0" class="flex items-center gap-2 text-sm">
        <button 
          v-for="opt in sortOptions" :key="opt.value"
          @click="commentSort = opt.value; loadComments()"
          class="px-2 py-1 rounded text-xs transition"
          :class="commentSort === opt.value 
            ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 发表评论 + 评分 -->
    <div v-if="isLoggedIn" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">我的评分：</span>
          <div class="flex items-center gap-1 text-lg cursor-pointer">
            <FaIcon
              v-for="i in 5" 
              :key="i"
              :icon="i <= (hoverRating || pendingRating) ? 'fa6-solid:star' : 'fa6-regular:star'"
              class="hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
              @mouseenter="hoverRating = i"
              @mouseleave="hoverRating = 0"
              @click="pendingRating = i"
            />
          </div>
          <span v-if="pendingRating" class="text-sm text-gray-500">{{ pendingRating }} 分</span>
          <span v-if="userRating && !pendingRating" class="text-xs text-green-600">
            <Icon name="fa6-solid:check" class="mr-1" />已评 {{ userRating }} 分
          </span>
        </div>
        <button 
          @click="$emit('submitComment', { content: commentContent, playTime: commentPlayTime, rating: pendingRating })"
          :disabled="isEmptyRichText(commentContent)"
          class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 transition disabled:opacity-50 hover:scale-105 active:scale-95"
        >
          {{ pendingRating ? '评分并发送' : '发送评论' }}
        </button>
      </div>
      <LazyTiptapEditor
        ref="commentEditorRef"
        v-model="commentContent"
        placeholder="发表你的看法（评分需配合评论一起提交）..."
        :show-play-time-option="true"
        :initial-play-time="0"
        :min-height="120"
        @update:play-time="commentPlayTime = $event"
      />
    </div>

    <!-- 未登录提示 -->
    <div v-else class="flex items-center justify-center gap-1.5 py-4 text-sm text-gray-500 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
      <NuxtLink
        :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`"
        class="text-gray-800 dark:text-gray-200 font-medium hover:underline"
      >登录</NuxtLink>
      <span>来参与评论</span>
    </div>

    <!-- 评论列表 -->
    <div class="space-y-4 pt-2">
      <div v-for="comment in comments" :key="comment.id" class="flex gap-3 group">
          <NuxtLink :to="`/user/${comment.user.id}`" class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-500 overflow-hidden">
              <img v-if="comment.user.avatar" :src="comment.user.avatar" class="w-full h-full object-cover" />
              <Icon name="fa6-solid:user" v-else />
            </div>
          </NuxtLink>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 text-sm flex-wrap">
              <NuxtLink :to="`/user/${comment.user.id}`" class="font-medium hover:underline">{{ comment.user.username }}</NuxtLink>
              <span
                v-if="(comment.user as any).title"
                class="px-1.5 py-0.5 rounded text-[11px] font-medium border leading-none"
                :style="{ color: (comment.user as any).titleColor || '#6366f1', borderColor: (comment.user as any).titleColor || '#6366f1' }"
              >{{ (comment.user as any).title }}</span>
              <span v-if="comment.playTime" class="inline-flex items-center gap-1 text-xs text-gray-400">
                <Icon name="fa6-solid:clock" class="leading-none" />
                <span class="leading-none">{{ comment.playTime }} 小时</span>
              </span>
              <span class="text-xs text-gray-500">{{ formatDate(comment.createdAt) }}</span>
              <span v-if="isEdited(comment)" class="text-xs text-gray-400">(已编辑)</span>
            </div>
            <!-- 编辑模式 -->
            <div v-if="editingComment?.id === comment.id" class="mt-2">
              <LazyTiptapInput
                v-model="editContent"
                placeholder="编辑评论..."
              />
              <div class="flex justify-end gap-2 mt-2">
                <button @click="cancelEdit" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">取消</button>
                <button 
                  @click="submitEdit(comment)"
                  :disabled="isEmptyRichText(editContent) || editSubmitting"
                  class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >{{ editSubmitting ? '保存中...' : '保存' }}</button>
              </div>
            </div>
            <!-- 正常显示 -->
            <SafeHtml v-else class="text-sm text-gray-700 dark:text-gray-300 mt-1 prose prose-sm dark:prose-invert max-w-none" :content="comment.content" />
            
            <!-- 评论操作栏 -->
            <div class="flex items-center gap-4 mt-2 text-xs">
              <button 
                @click="$emit('likeComment', comment)"
                class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
                :class="{ 'text-red-500': comment.isLiked }"
              >
                <Icon :name="comment.isLiked ? 'fa6-solid:heart' : 'fa6-regular:heart'" />
                <span v-if="comment.likeCount > 0">{{ comment.likeCount }}</span>
                <span v-else>点赞</span>
              </button>
              <button 
                @click="startReply(comment)"
                class="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition"
              >
                <Icon name="fa6-solid:reply" /><span>回复</span>
              </button>
              <button 
                v-if="isLoggedIn && comment.user.id !== currentUserId"
                @click="$emit('reportComment', comment)"
                class="flex items-center gap-1 text-gray-400 hover:text-orange-500 transition"
              >
                <Icon name="fa6-solid:flag" /><span>举报</span>
              </button>
              <button 
                v-if="isLoggedIn && comment.user.id === currentUserId && canEdit(comment)"
                @click="startEdit(comment)"
                class="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition"
              >
                <Icon name="fa6-solid:pen" /><span>编辑</span>
              </button>
              <button 
                v-if="isLoggedIn && (comment.user.id === currentUserId || isAdmin)"
                @click="$emit('deleteComment', comment)"
                class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
              >
                <Icon name="fa6-solid:trash" /><span>删除</span>
              </button>
            </div>

            <!-- 回复输入框 -->
            <Transition name="fade">
            <div v-if="replyingTo?.id === comment.id" class="mt-3 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
              <div class="text-xs text-gray-500 mb-2">回复 @{{ comment.user.username }}</div>
              <LazyTiptapInput
                v-model="replyContent"
                placeholder="写下你的回复..."
                @submit="submitReply(comment)"
              />
              <div class="flex justify-end gap-2 mt-2">
                <button @click="cancelReply" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">取消</button>
                <button
                  @click="submitReply(comment)"
                  :disabled="isEmptyRichText(replyContent)"
                  class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >回复</button>
              </div>
            </div>
            </Transition>

            <!-- 回复列表 -->
            <div v-if="comment.replies?.length" class="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-zinc-700">
              <div v-for="reply in comment.replies" :key="reply.id" class="flex gap-2 group/reply">
                <NuxtLink :to="`/user/${reply.user.id}`" class="flex-shrink-0">
                  <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-500 overflow-hidden">
                    <img v-if="reply.user.avatar" :src="reply.user.avatar" class="w-full h-full object-cover" />
                    <Icon name="fa6-solid:user" class="text-xs" v-else />
                  </div>
                </NuxtLink>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 text-xs">
                    <NuxtLink :to="`/user/${reply.user.id}`" class="font-medium hover:underline">{{ reply.user.username }}</NuxtLink>
                    <span class="text-gray-500">{{ formatDate(reply.createdAt) }}</span>
                  </div>
                  <SafeHtml class="text-sm text-gray-700 dark:text-gray-300 mt-0.5" :content="reply.content" />
                  <div class="flex items-center gap-3 mt-1 text-xs">
                    <button 
                      @click="$emit('likeComment', reply)"
                      class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
                      :class="{ 'text-red-500': reply.isLiked }"
                    >
                      <Icon :name="reply.isLiked ? 'fa6-solid:heart' : 'fa6-regular:heart'" class="text-[10px]" />
                      <span v-if="reply.likeCount > 0">{{ reply.likeCount }}</span>
                    </button>
                    <button 
                      @click="startReplyToReply(comment, reply)"
                      class="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition"
                    >
                      <Icon name="fa6-solid:reply" class="text-[10px]" /><span>回复</span>
                    </button>
                    <button 
                      v-if="isLoggedIn && reply.user.id !== currentUserId"
                      @click="$emit('reportComment', reply)"
                      class="text-gray-400 hover:text-orange-500 transition"
                    >
                      <Icon name="fa6-solid:flag" class="text-[10px]" />
                    </button>
                    <button 
                      v-if="isLoggedIn && (reply.user.id === currentUserId || isAdmin)"
                      @click="$emit('deleteComment', reply)"
                      class="flex items-center gap-1 text-gray-400 hover:text-red-500 transition"
                    >
                      <Icon name="fa6-solid:trash" class="text-[10px]" /><span>删除</span>
                    </button>
                  </div>
                  
                  <!-- 回复输入框 -->
                  <div v-if="replyingTo?.id === reply.id" class="mt-3 p-3 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
                    <div class="text-xs text-gray-500 mb-2">回复 @{{ reply.user.username }}</div>
                    <LazyTiptapInput
                      v-model="replyContent"
                      placeholder="写下你的回复..."
                      @submit="submitReplyToReply(comment)"
                    />
                    <div class="flex justify-end gap-2 mt-2">
                      <button @click="cancelReply" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">取消</button>
                      <button
                        @click="submitReplyToReply(comment)"
                        :disabled="isEmptyRichText(replyContent)"
                        class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >回复</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!comments?.length" key="empty" class="text-center text-gray-500 py-4">
        暂无评论，来发表第一条评论吧
      </div>
    </div>

    <!-- 评论分页 -->
    <Pagination 
      v-if="commentPagination && commentPagination.totalPages > 1"
      :current-page="commentPage"
      :total-pages="commentPagination.totalPages"
      @page-change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  gameId: number
  isLoggedIn: boolean
  currentUserId?: number
  isAdmin: boolean
  userRating: number
  initialComments?: any[]
  totalComments: number
}>()

const emit = defineEmits([
  'submitComment', 'likeComment', 'reportComment', 'deleteComment', 'reply',
])

const { authFetch } = useAuthRequest()
const { formatDate } = useFormatDate()
const toast = useToast()
const route = useRoute()

// 排序选项
const sortOptions = [
  { value: 'latest', label: '最新' },
  { value: 'oldest', label: '最早' },
  { value: 'likes', label: '最热' },
]

const commentSort = ref('latest')
const commentPage = ref(1)
const comments = ref<any[]>(props.initialComments || [])
const commentPagination = ref<any>(null)
const commentContent = ref('')
const commentPlayTime = ref(0)
const commentEditorRef = ref<any>(null)
const pendingRating = ref(0)
const hoverRating = ref(0)
const replyingTo = ref<any>(null)
const replyContent = ref('')
const editingComment = ref<any>(null)
const editContent = ref('')
const editSubmitting = ref(false)

// 检查评论是否被编辑过
function isEdited(comment: any) {
  if (!comment.updatedAt || !comment.createdAt) return false
  const created = new Date(comment.createdAt).getTime()
  const updated = new Date(comment.updatedAt).getTime()
  return updated - created > 1000 // 超过1秒差异认为是编辑过
}

// 检查是否可以编辑（24小时内）
function canEdit(comment: any) {
  const created = new Date(comment.createdAt).getTime()
  const now = Date.now()
  return now - created < 24 * 60 * 60 * 1000
}

// 开始编辑
function startEdit(comment: any) {
  editingComment.value = comment
  // 从HTML中提取纯文本或保留HTML
  editContent.value = comment.content
}

// 取消编辑
function cancelEdit() {
  editingComment.value = null
  editContent.value = ''
}

// 提交编辑
async function submitEdit(comment: any) {
  if (isEmptyRichText(editContent.value)) return
  editSubmitting.value = true
  try {
    await (authFetch as any)(`/api/comments/${comment.id}`, {
      method: 'PUT',
      body: { content: editContent.value },
    })
    cancelEdit()
    await loadComments()
    toast.success('编辑成功')
  } catch (error: any) {
    toast.error(error.data?.message || '编辑失败')
  } finally {
    editSubmitting.value = false
  }
}

async function loadComments() {
  try {
    const data: any = await $fetch(`/api/games/${props.gameId}/comments`, {
      params: {
        page: commentPage.value,
        limit: 20,
        sort: commentSort.value,
      },
    } as any)
    comments.value = data.items
    commentPagination.value = data.pagination
  } catch (error) {
    console.error('Load comments error:', error)
  }
}

function handlePageChange(page: number) {
  commentPage.value = page
  loadComments()
}

function startReply(comment: any) {
  if (!props.isLoggedIn) { toast.error('请先登录'); return }
  replyingTo.value = comment
  replyContent.value = ''
}

function startReplyToReply(_parentComment: any, reply: any) {
  if (!props.isLoggedIn) { toast.error('请先登录'); return }
  replyingTo.value = reply
  replyContent.value = ''
}

function cancelReply() {
  replyingTo.value = null
  replyContent.value = ''
}

async function submitReply(comment: any) {
  if (isEmptyRichText(replyContent.value)) return
  try {
    await (authFetch as any)(`/api/games/${props.gameId}/comment`, {
      method: 'POST',
      body: { content: replyContent.value, parentId: comment.id },
    })
    cancelReply()
    await loadComments()
    toast.success('回复成功')
  } catch (error: any) {
    toast.error(error.data?.message || '回复失败')
  }
}

async function submitReplyToReply(parentComment: any) {
  if (isEmptyRichText(replyContent.value)) return
  try {
    await (authFetch as any)(`/api/games/${props.gameId}/comment`, {
      method: 'POST',
      body: { content: replyContent.value, parentId: parentComment.id },
    })
    cancelReply()
    await loadComments()
    toast.success('回复成功')
  } catch (error: any) {
    toast.error(error.data?.message || '回复失败')
  }
}

// 初始加载
onMounted(() => {
  if (!props.initialComments?.length) {
    loadComments()
  }
})

// 暴露方法给父组件
defineExpose({
  refresh: loadComments,
  clearEditor: () => {
    commentContent.value = ''
    commentPlayTime.value = 0
    commentEditorRef.value?.clear()
    pendingRating.value = 0
  },
})
</script>


<style scoped>
/* 保留空段落，显示为空行 */
:deep(.prose p:empty) {
  min-height: 1.5em;
  display: block;
}

/* 确保段落之间有间距 */
:deep(.prose p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* 第一个段落不需要上边距 */
:deep(.prose p:first-child) {
  margin-top: 0;
}

/* 最后一个段落不需要下边距 */
:deep(.prose p:last-child) {
  margin-bottom: 0;
}
</style>

<template>
  <div class="max-w-4xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div v-if="pending" class="py-20 text-center text-gray-500">正在加载攻略…</div>
    <div v-else-if="error || !guide" class="py-20 text-center text-gray-500">
      <p class="mb-4">攻略不存在或已被删除</p>
      <NuxtLink :to="`/games/${gameId}/guides`" class="text-blue-600 hover:underline">返回攻略列表</NuxtLink>
    </div>
    <article v-else class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <header class="p-5 sm:p-8 border-b dark:border-zinc-700">
        <NuxtLink :to="`/games/${gameId}/guides`" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-5">
          <Icon name="fa6-solid:arrow-left" />返回攻略列表
        </NuxtLink>
        <h1 class="text-2xl sm:text-3xl font-bold leading-tight">{{ guide.title }}</h1>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
          <NuxtLink :to="`/user/${guide.user.id}`" class="inline-flex items-center gap-1.5 hover:underline">
            <img v-if="guide.user.avatar" :src="guide.user.avatar" class="w-5 h-5 rounded-full" />
            <Icon v-else name="fa6-solid:user" />{{ guide.user.username }}
          </NuxtLink>
          <span><Icon name="fa6-solid:calendar" class="mr-1" />{{ formatDate(guide.createdAt) }}</span>
          <span><Icon name="fa6-solid:eye" class="mr-1" />{{ guide.viewCount }}</span>
          <span><Icon name="fa6-solid:heart" class="mr-1" />{{ guide.likeCount || 0 }}</span>
        </div>
      </header>

      <SafeHtml class="p-5 sm:p-8 prose dark:prose-invert max-w-none guide-content" :content="guide.content" />

      <footer class="p-5 sm:p-8 border-t dark:border-zinc-700 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button v-if="isLoggedIn" @click="toggleLike" class="px-3 py-2 text-sm rounded-lg border dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700" :class="guide.isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'">
            <Icon :name="guide.isLiked ? 'fa6-solid:heart' : 'fa6-regular:heart'" class="mr-1" />{{ guide.likeCount || '点赞' }}
          </button>
          <button v-if="isLoggedIn && guide.user.id !== user?.id" @click="reporting = true" class="px-3 py-2 text-sm rounded-lg border dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:text-red-500">
            <Icon name="fa6-solid:flag" class="mr-1" />举报
          </button>
        </div>
        <NuxtLink :to="`/games/${gameId}/guides`" class="px-4 py-2 text-sm rounded-lg bg-gray-800 dark:bg-zinc-600 text-white">返回列表</NuxtLink>
      </footer>
    </article>

    <Teleport to="body">
      <div v-if="reporting" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" @click.self="reporting = false">
        <div class="bg-white dark:bg-zinc-800 rounded-xl p-5 w-full max-w-md shadow-xl">
          <h2 class="font-semibold mb-4">举报攻略</h2>
          <select v-model="reportReason" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 mb-3">
            <option>垃圾广告</option><option>违规内容</option><option>恶意剧透</option><option>其他</option>
          </select>
          <textarea v-model="reportDetail" rows="3" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600" maxlength="1000" :required="reportReason === '其他'" :placeholder="reportReason === '其他' ? '请详细说明举报理由（必填）' : '补充说明（可选）'"></textarea>
          <p v-if="reportDetailMissing" class="mt-1 text-xs text-red-500">选择“其他”时，请填写具体举报理由</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="reporting = false" class="px-3 py-2 text-sm text-gray-500">取消</button>
            <button @click="submitReport" :disabled="reportDetailMissing || reportSubmitting" class="px-3 py-2 text-sm rounded-lg bg-gray-800 text-white disabled:opacity-50">{{ reportSubmitting ? '提交中…' : '提交举报' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gameId = computed(() => Number.parseInt(route.params.id as string))
const guideId = computed(() => Number.parseInt(route.params.guideId as string))
const { data: session, status } = useAuth()
const { authFetch } = useAuthRequest()
const toast = useToast()
const user = computed(() => session.value as any)
const isLoggedIn = computed(() => status.value === 'authenticated')
const { data: guide, pending, error } = await useAuthFetch<any>(`/api/guides/${guideId.value}`, { key: `guide-detail-${guideId.value}` })
const reporting = ref(false)
const reportSubmitting = ref(false)
const reportReason = ref('垃圾广告')
const reportDetail = ref('')
const reportDetailMissing = computed(() => reportReason.value === '其他' && !reportDetail.value.trim())
const { formatDate } = useFormatDate()

onMounted(async () => {
  if (guide.value) {
    await ($fetch as any)(`/api/guides/${guideId.value}/view`, { method: 'POST' }).catch(() => {})
    guide.value.viewCount = (guide.value.viewCount || 0) + 1
  }
})

async function toggleLike() {
  if (!guide.value) return
  try {
    const result = await authFetch<{ liked: boolean; likeCount: number }>(`/api/guides/${guideId.value}/like`, { method: 'POST' })
    guide.value.isLiked = result.liked
    guide.value.likeCount = result.likeCount
  } catch (e: any) {
    toast.error(e.data?.message || '操作失败')
  }
}

async function submitReport() {
  if (reportSubmitting.value) return
  if (reportDetailMissing.value) {
    toast.error('选择“其他”时，请填写具体举报理由')
    return
  }
  reportSubmitting.value = true
  try {
    await authFetch('/api/reports', { method: 'POST', body: { type: 'GUIDE', targetId: guideId.value, reason: reportReason.value, detail: reportDetail.value.trim() || null } })
    toast.success('举报已提交')
    reporting.value = false
  } catch (e: any) {
    toast.error(e.data?.message || '举报失败')
  } finally {
    reportSubmitting.value = false
  }
}

useHead({
  title: computed(() => guide.value ? `${guide.value.title} - 攻略` : '攻略'),
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">资源审核</h1>
    
    <!-- 筛选器 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">状态</span>
          <select 
            v-model="filterStatus"
            class="px-3 py-1.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
          >
            <option value="">全部</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已拒绝</option>
          </select>
        </div>
        <div v-if="pendingCount > 0" class="text-sm text-orange-500">
          <i class="fa-solid fa-circle-exclamation mr-1"></i>
          {{ pendingCount }} 个资源待审核
        </div>
      </div>
      
      <!-- 批量操作 -->
      <div v-if="selectedIds.length > 0" class="flex items-center gap-4 mt-4 pt-4 border-t dark:border-zinc-700">
        <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 项</span>
        <button
          @click="batchApprove"
          class="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          <i class="fa-solid fa-check mr-1"></i>批量通过
        </button>
        <button
          @click="showBatchRejectModal"
          class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          <i class="fa-solid fa-xmark mr-1"></i>批量拒绝
        </button>
        <button
          @click="clearSelection"
          class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          取消选择
        </button>
      </div>
    </div>

    <!-- 资源列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <div v-if="pending" class="text-center py-12">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      
      <div v-else-if="!resources?.length" class="text-center py-12 text-gray-500">
        暂无资源需要审核
      </div>
      
      <div v-else class="divide-y dark:divide-zinc-700">
        <!-- 全选操作 -->
        <div v-if="pendingResources.length > 0" class="px-4 py-2 bg-gray-50 dark:bg-zinc-700/50 flex items-center gap-2">
          <input 
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
            class="rounded border-gray-300 dark:border-zinc-600"
          />
          <span class="text-sm text-gray-500">选择全部待审核资源</span>
        </div>
        
        <div 
          v-for="resource in resources"
          :key="resource.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <input 
                v-if="resource.status === 'PENDING'"
                type="checkbox"
                :checked="selectedIds.includes(resource.id)"
                @change="toggleSelect(resource.id)"
                class="mt-1 rounded border-gray-300 dark:border-zinc-600"
              />
              <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span 
                  class="px-2 py-0.5 text-xs rounded"
                  :class="{
                    'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400': resource.status === 'PENDING',
                    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': resource.status === 'APPROVED',
                    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': resource.status === 'REJECTED',
                  }"
                >
                  {{ statusLabels[resource.status] }}
                </span>
                <span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                  <i :class="resource.type?.icon || 'fa-solid fa-file'" class="mr-1"></i>
                  {{ resource.type?.name || '未知类型' }}
                </span>
                <span
                  v-if="resource.healthStatus && resource.healthStatus !== 'AVAILABLE'"
                  class="px-2 py-0.5 text-xs rounded"
                  :class="resourceHealthClass(resource.healthStatus)"
                >
                  {{ resourceHealthLabel(resource.healthStatus) }}
                  <template v-if="resource.issueCount"> · {{ resource.issueCount }}</template>
                </span>
              </div>
              
              <h3 class="font-medium mb-1">{{ resource.title }}</h3>
              
              <div class="text-sm text-gray-500 mb-2">
                所属游戏
                <NuxtLink 
                  :to="`/games/${resource.gameId}`"
                  class="text-blue-500 hover:underline"
                  target="_blank"
                >
                  {{ getGameTitle(resource.game) }}
                </NuxtLink>
              </div>
              
              <div class="text-sm space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-gray-500">链接</span>
                  <a 
                    :href="resource.url" 
                    target="_blank" 
                    class="text-blue-500 hover:underline truncate max-w-md"
                  >
                    {{ resource.url }}
                  </a>
                </div>
                <div v-if="resource.extractCode" class="flex items-center gap-2">
                  <span class="text-gray-500">提取密码</span>
                  <code class="px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded text-sm">{{ resource.extractCode }}</code>
                </div>
                <div v-if="resource.unzipPassword" class="flex items-center gap-2">
                  <span class="text-gray-500">解压密码</span>
                  <code class="px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded text-sm">{{ resource.unzipPassword }}</code>
                </div>
                <div v-if="resource.remark" class="flex items-start gap-2">
                  <span class="text-gray-500 flex-shrink-0">备注</span>
                  <span class="text-gray-600 dark:text-gray-400">{{ resource.remark }}</span>
                </div>
              </div>

              <div v-if="resource.language || resource.fileSize || resource.isMachineTranslated" class="flex flex-wrap gap-1.5 mt-2">
                <span v-if="resource.language" class="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {{ languageLabels[resource.language as ResourceReviewLanguage] || resource.language }}
                </span>
                <span v-if="resource.fileSize" class="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300">
                  {{ resource.fileSize }}
                </span>
                <span v-if="resource.isMachineTranslated" class="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  机翻
                </span>
              </div>
              
              <div class="text-xs text-gray-500 mt-3">
                上传者：{{ resource.uploader?.username }} · {{ formatDate(resource.createdAt) }}
              </div>
              </div>
            </div>
            
            <div class="flex flex-col gap-2">
              <template v-if="resource.status === 'PENDING'">
                <button
                  @click="showReviewModal(resource, 'approve')"
                  class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  <i class="fa-solid fa-check mr-1"></i>通过
                </button>
                <button
                  @click="showReviewModal(resource, 'reject')"
                  class="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  <i class="fa-solid fa-xmark mr-1"></i>拒绝
                </button>
              </template>
              <button
                v-if="resource.healthStatus && resource.healthStatus !== 'AVAILABLE'"
                @click="updateResourceHealth(resource, 'AVAILABLE')"
                class="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                <i class="fa-solid fa-circle-check mr-1"></i>标记可用
              </button>
              <button
                v-if="resource.healthStatus !== 'UNAVAILABLE'"
                @click="showHealthModal(resource)"
                class="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <i class="fa-solid fa-ban mr-1"></i>标记失效
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="totalPages > 1"
      :current="page"
      :total="totalPages"
      @change="page = $event"
      class="mt-6"
    />

    <!-- 审核弹窗 -->
    <Modal v-model="reviewModalVisible" :title="reviewAction === 'approve' ? '通过资源' : '拒绝资源'">
      <div class="space-y-4">
        <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-4">
          <div class="text-sm font-medium mb-2">{{ currentResource?.title }}</div>
          <div class="text-xs text-gray-500">
            上传者：{{ currentResource?.uploader?.username }}
          </div>
        </div>
        
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ reviewAction === 'approve' ? '确认通过该资源？通过后用户可以在游戏页面看到并下载。' : '确认拒绝该资源？拒绝后该资源不会对用户展示。' }}
        </p>
        
        <div v-if="reviewAction === 'reject'">
          <label class="block text-sm font-medium mb-2">拒绝原因</label>
          <textarea 
            v-model="reviewNote"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="3"
            placeholder="请输入拒绝原因，会通知上传者..."
          ></textarea>
        </div>
        
        <div class="flex justify-end gap-3">
          <button
            @click="reviewModalVisible = false"
            class="px-4 py-2 text-sm border dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            取消
          </button>
          <button
            @click="handleReview"
            :disabled="reviewing || (reviewAction === 'reject' && !reviewNote.trim())"
            class="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
            :class="reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'"
          >
            {{ reviewing ? '处理中...' : (reviewAction === 'approve' ? '确认通过' : '确认拒绝') }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- 批量拒绝弹窗 -->
    <Modal v-model="batchRejectModalVisible" title="批量拒绝资源">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          确认拒绝选中的 {{ selectedIds.length }} 个资源？拒绝原因会通知上传者。
        </p>

        <div>
          <label class="block text-sm font-medium mb-2">拒绝原因</label>
          <textarea
            v-model="batchRejectNote"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="3"
            placeholder="请输入拒绝原因..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="batchRejectModalVisible = false"
            class="px-4 py-2 text-sm border dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            取消
          </button>
          <button
            @click="batchReject"
            :disabled="batchRejecting || !batchRejectNote.trim()"
            class="px-4 py-2 text-sm text-white rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50"
          >
            {{ batchRejecting ? '处理中...' : '确认拒绝' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- 资源可用性弹窗 -->
    <Modal v-model="healthModalVisible" title="标记资源失效">
      <div class="space-y-4">
        <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-4">
          <div class="text-sm font-medium mb-2">{{ currentHealthResource?.title }}</div>
          <div class="text-xs text-gray-500">
            上传者：{{ currentHealthResource?.uploader?.username }}
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">处理备注</label>
          <textarea
            v-model="healthNote"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="3"
            placeholder="说明失效原因或复查结果，会通知上传者..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="healthModalVisible = false"
            class="px-4 py-2 text-sm border dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            取消
          </button>
          <button
            @click="confirmResourceUnavailable"
            :disabled="updatingHealth || !healthNote.trim()"
            class="px-4 py-2 text-sm text-white rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50"
          >
            {{ updatingHealth ? '处理中...' : '确认标记失效' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { ResourceReviewItem, ResourceReviewsResponse, ResourceReviewLanguage } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

const page = ref(1)
const filterStatus = ref('PENDING')
const reviewModalVisible = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewNote = ref('')
const reviewing = ref(false)
const currentResource = ref<ResourceReviewItem | null>(null)
const selectedIds = ref<number[]>([])
const batchRejectModalVisible = ref(false)
const batchRejectNote = ref('')
const batchRejecting = ref(false)
const healthModalVisible = ref(false)
const currentHealthResource = ref<ResourceReviewItem | null>(null)
const healthNote = ref('')
const updatingHealth = ref(false)

const statusLabels: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}

const languageLabels: Record<ResourceReviewLanguage, string> = {
  ja: '日文',
  en: '英文',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁体中文',
}

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
    NEEDS_REVIEW: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    SUSPECTED_BAD: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    UNAVAILABLE: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }
  return map[status] || 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
}

// 获取待审核资源
const { data, pending, refresh } = await useAuthFetch<ResourceReviewsResponse>('/api/admin/resource-reviews', {
  key: 'admin-resource-reviews',
  query: computed(() => ({
    page: page.value,
    status: filterStatus.value || undefined,
  })),
})

const resources = computed(() => data.value?.resources || [])
const totalPages = computed(() => data.value?.totalPages || 1)
const pendingCount = computed(() => data.value?.pendingCount || 0)
const pendingResources = computed(() => resources.value.filter(r => r.status === 'PENDING'))

// 全选状态
const isAllSelected = computed(() => {
  if (!pendingResources.value.length) return false
  return pendingResources.value.every(r => selectedIds.value.includes(r.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = pendingResources.value.map(r => r.id)
  }
}

function toggleSelect(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function clearSelection() {
  selectedIds.value = []
}

async function batchApprove() {
  if (!confirm(`确认通过选中的 ${selectedIds.value.length} 个资源？`)) return
  
  try {
    await authFetch('/api/admin/resource-reviews/batch', {
      method: 'POST',
      body: { ids: selectedIds.value, action: 'approve' },
    })
    toast.success(`已通过 ${selectedIds.value.length} 个资源`)
    selectedIds.value = []
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '批量通过失败')
  }
}

function showBatchRejectModal() {
  batchRejectNote.value = ''
  batchRejectModalVisible.value = true
}

async function batchReject() {
  const reason = batchRejectNote.value.trim()
  if (!reason) {
    toast.error('请填写拒绝原因')
    return
  }
  
  try {
    batchRejecting.value = true
    await authFetch('/api/admin/resource-reviews/batch', {
      method: 'POST',
      body: { ids: selectedIds.value, action: 'reject', note: reason },
    })
    toast.success(`已拒绝 ${selectedIds.value.length} 个资源`)
    selectedIds.value = []
    batchRejectModalVisible.value = false
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '批量拒绝失败')
  } finally {
    batchRejecting.value = false
  }
}

function getGameTitle(game: ResourceReviewItem['game']) {
  if (!game) return '未知游戏'
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || `游戏 #${game.id}`
}

function showReviewModal(resource: ResourceReviewItem, action: 'approve' | 'reject') {
  currentResource.value = resource
  reviewAction.value = action
  reviewNote.value = ''
  reviewModalVisible.value = true
}

function showHealthModal(resource: ResourceReviewItem) {
  currentHealthResource.value = resource
  healthNote.value = ''
  healthModalVisible.value = true
}

async function updateResourceHealth(resource: ResourceReviewItem, healthStatus: 'AVAILABLE' | 'UNAVAILABLE', note?: string) {
  if (healthStatus === 'UNAVAILABLE' && !note?.trim()) return

  try {
    updatingHealth.value = true
    await authFetch(`/api/admin/resources/${resource.id}/health`, {
      method: 'PUT',
      body: {
        healthStatus,
        healthNote: note?.trim() || '后台复查确认可用',
        clearIssueCount: healthStatus === 'AVAILABLE',
      },
    })
    toast.success(healthStatus === 'AVAILABLE' ? '已标记为可用' : '已标记为失效')
    healthModalVisible.value = false
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '资源状态更新失败')
  } finally {
    updatingHealth.value = false
  }
}

async function confirmResourceUnavailable() {
  if (!currentHealthResource.value) return
  if (!healthNote.value.trim()) {
    toast.error('请填写处理备注')
    return
  }
  await updateResourceHealth(currentHealthResource.value, 'UNAVAILABLE', healthNote.value)
}

async function handleReview() {
  if (!currentResource.value) return
  
  if (reviewAction.value === 'reject' && !reviewNote.value.trim()) {
    toast.error('请填写拒绝原因')
    return
  }
  
  reviewing.value = true
  try {
    await authFetch(`/api/admin/resource-reviews/${currentResource.value.id}`, {
      method: 'POST',
      body: { 
        action: reviewAction.value,
        note: reviewNote.value || undefined,
      },
    })
    toast.success(reviewAction.value === 'approve' ? '资源已通过' : '资源已拒绝')
    reviewModalVisible.value = false
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '审核失败')
  } finally {
    reviewing.value = false
  }
}

useHead({
  title: '资源审核 - 管理后台',
})
</script>

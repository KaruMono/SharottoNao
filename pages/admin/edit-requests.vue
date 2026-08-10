<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">条目修改审核</h1>
    
    <!-- 筛选栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">状态：</span>
          <select 
            v-model="filterStatus"
            class="px-3 py-1.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
          >
            <option value="">全部</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已驳回</option>
          </select>
        </div>
        <div v-if="pendingCount > 0" class="text-sm text-orange-500">
          <i class="fa-solid fa-circle-exclamation mr-1"></i>
          {{ pendingCount }} 条待审核
        </div>
      </div>
      
      <!-- 批量操作栏 -->
      <div v-if="selectedIds.length > 0" class="flex items-center gap-4 mt-4 pt-4 border-t dark:border-zinc-700">
        <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 项</span>
        <button 
          @click="batchApprove"
          class="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          <i class="fa-solid fa-check mr-1"></i>批量通过
        </button>
        <button 
          @click="batchReject"
          class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          <i class="fa-solid fa-xmark mr-1"></i>批量驳回
        </button>
        <button 
          @click="clearSelection"
          class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          取消选择
        </button>
      </div>
    </div>

    <!-- 请求列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <div v-if="pending" class="text-center py-12">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
      
      <div v-else-if="!requests?.length" class="text-center py-12 text-gray-500">
        暂无审核请求
      </div>
      
      <div v-else class="divide-y dark:divide-zinc-700">
        <!-- 全选复选框 -->
        <div v-if="pendingRequests.length > 0" class="px-4 py-2 bg-gray-50 dark:bg-zinc-700/50 flex items-center gap-2">
          <input 
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
            class="rounded border-gray-300 dark:border-zinc-600"
          />
          <span class="text-sm text-gray-500">全选待审核项</span>
        </div>
        
        <div 
          v-for="request in requests"
          :key="request.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-start gap-3">
              <input 
                v-if="request.status === 'PENDING'"
                type="checkbox"
                :checked="selectedIds.includes(request.id)"
                @change="toggleSelect(request.id)"
                class="mt-1 rounded border-gray-300 dark:border-zinc-600"
              />
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <NuxtLink 
                    :to="`/games/${request.gameId}`"
                    class="font-medium text-blue-500 hover:underline"
                    target="_blank"
                  >
                    {{ getGameTitle(request.game) || `游戏 #${request.gameId}` }}
                  </NuxtLink>
                  <span 
                    class="px-2 py-0.5 text-xs rounded"
                    :class="{
                      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400': request.status === 'PENDING',
                      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': request.status === 'APPROVED',
                      'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400': request.status === 'REJECTED',
                    }"
                  >
                    {{ statusLabels[request.status] }}
                  </span>
                </div>
                <div class="text-xs text-gray-500">
                  提交者：{{ request.user?.username }} · {{ formatDate(request.createdAt) }}
                </div>
              </div>
            </div>
            
            <div v-if="request.status === 'PENDING'" class="flex gap-2">
              <button 
                @click="showReviewModal(request, 'approve')"
                class="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <i class="fa-solid fa-check mr-1"></i>通过
              </button>
              <button 
                @click="showReviewModal(request, 'reject')"
                class="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                <i class="fa-solid fa-xmark mr-1"></i>驳回
              </button>
            </div>
          </div>
          
          <!-- 变更详情 -->
          <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-4 text-sm">
            <h4 class="font-medium mb-3">修改内容：</h4>
            <div class="space-y-2">
              <template v-for="(change, field) in request.changes" :key="field">
                <!-- 标签字段：chip 展示（用 tagMap 解析名称） -->
                <div v-if="field === 'tagIds' || field === 'newTagNames'" class="grid grid-cols-3 gap-4">
                  <div class="font-medium text-gray-600 dark:text-gray-400">{{ fieldLabels[field] || field }}</div>
                  <div class="flex flex-wrap gap-1 col-span-2">
                    <!-- 被删除的标签（只在 tagIds 里） -->
                    <template v-if="field === 'tagIds'">
                      <span
                        v-for="id in removedTagIds(change)"
                        :key="'rm-' + id"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs line-through opacity-60"
                        :style="tagChipStyle(id)"
                      >{{ tagName(id) }}</span>
                      <!-- 保留或新增的已有标签 -->
                      <span
                        v-for="id in addedTagIds(change)"
                        :key="'add-' + id"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ring-1 ring-green-400"
                        :style="tagChipStyle(id)"
                      >
                        {{ tagName(id) }}
                        <span v-if="tagIsNsfw(id)" class="ml-0.5 text-[10px] font-bold text-amber-500">18+</span>
                      </span>
                      <span
                        v-for="id in keptTagIds(change)"
                        :key="'keep-' + id"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        :style="tagChipStyle(id)"
                      >
                        {{ tagName(id) }}
                        <span v-if="tagIsNsfw(id)" class="ml-0.5 text-[10px] font-bold text-amber-500">18+</span>
                      </span>
                    </template>
                    <!-- 待创建的新标签 -->
                    <template v-if="field === 'newTagNames'">
                      <span
                        v-for="name in (change.new as string[])"
                        :key="'new-' + name"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-blue-400 text-blue-600 dark:text-blue-400"
                      >
                        <i class="fa-solid fa-plus text-[10px]"></i>{{ name }}
                      </span>
                    </template>
                  </div>
                </div>
                <!-- 其他字段：原有展示 -->
                <div v-else class="grid grid-cols-3 gap-4">
                  <div class="font-medium text-gray-600 dark:text-gray-400">{{ fieldLabels[field] || field }}</div>
                  <div class="text-red-500 line-through truncate" :title="formatValue(change.old)">
                    {{ formatValue(change.old) || '(空)' }}
                  </div>
                  <div class="text-green-600 truncate" :title="formatValue(change.new)">
                    {{ formatValue(change.new) || '(空)' }}
                  </div>
                </div>
              </template>
            </div>
          </div>
          
          <!-- 审核信息 -->
          <div v-if="request.reviewedBy" class="mt-3 text-xs text-gray-500">
            审核人：{{ request.reviewedBy.username }} · {{ request.reviewedAt ? formatDate(request.reviewedAt) : '-' }}
            <span v-if="request.reviewNote" class="ml-2">备注：{{ request.reviewNote }}</span>
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
    <Modal v-model="reviewModalVisible" :title="reviewAction === 'approve' ? '通过修改请求' : '驳回修改请求'" class="max-w-2xl">
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ reviewAction === 'approve' ? '确定要通过该修改请求吗？修改将立即应用到游戏条目。' : '确定要驳回该修改请求吗？' }}
        </p>

        <!-- 通过时展示可编辑标签区 -->
        <div
          v-if="reviewAction === 'approve' && reviewHasTags"
          class="border dark:border-zinc-600 rounded-lg p-3 space-y-3"
        >
          <p class="text-sm font-medium">
            最终标签
            <span class="ml-1 text-xs text-gray-400 font-normal">（可增删、可标记 NSFW；虚线为待创建新标签）</span>
          </p>

          <!-- Chip 区 -->
          <div class="flex flex-wrap gap-2 min-h-[2rem]">
            <!-- 已有标签 -->
            <span
              v-for="tag in reviewTagIds"
              :key="'rt-' + tag.id"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm select-none"
              :style="tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : { backgroundColor: 'rgba(107,114,128,0.12)', color: 'inherit' }"
            >
              {{ tag.name }}
              <!-- NSFW 角标：18+ 色为琥珀色，不与删除红冲突 -->
              <button
                type="button"
                class="text-[10px] font-bold leading-none px-1 rounded transition"
                :class="tag.isNsfw
                  ? 'bg-amber-400 text-white'
                  : 'bg-gray-200 dark:bg-zinc-600 text-gray-500 dark:text-zinc-300 hover:bg-amber-300'"
                :title="tag.isNsfw ? '已标记 NSFW（点击需确认取消）' : '点击标记此标签为 NSFW（全局生效）'"
                @click="toggleTagNsfw(tag)"
              >18+</button>
              <!-- 删除 × -->
              <button
                type="button"
                class="opacity-50 hover:opacity-100 hover:text-red-500 transition ml-0.5"
                title="从本次修改中移除该标签"
                @click="removeReviewTag(tag.id)"
              ><i class="fa-solid fa-xmark text-xs"></i></button>
            </span>

            <!-- 待创建的新标签 -->
            <span
              v-for="nt in reviewNewTags"
              :key="'rnt-' + nt.name"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border border-dashed select-none"
              :class="nt.isNsfw
                ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                : 'border-blue-400 text-blue-600 dark:text-blue-400'"
              :title="'新建标签「' + nt.name + '」' + (nt.isNsfw ? '（NSFW）' : '')"
            >
              <i class="fa-solid fa-plus text-xs opacity-70"></i>
              {{ nt.name }}
              <!-- NSFW 角标 -->
              <button
                type="button"
                class="text-[10px] font-bold leading-none px-1 rounded transition"
                :class="nt.isNsfw
                  ? 'bg-amber-400 text-white'
                  : 'bg-gray-200 dark:bg-zinc-600 text-gray-500 dark:text-zinc-300 hover:bg-amber-300'"
                title="切换 NSFW（仅影响这个新标签的创建参数）"
                @click="nt.isNsfw = !nt.isNsfw"
              >18+</button>
              <!-- 删除 × -->
              <button
                type="button"
                class="opacity-50 hover:opacity-100 hover:text-red-500 transition ml-0.5"
                title="不创建此标签"
                @click="removeReviewNewTag(nt.name)"
              ><i class="fa-solid fa-xmark text-xs"></i></button>
            </span>

            <!-- + 添加按钮 -->
            <div class="relative" ref="reviewTagDropdownRef">
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border dark:border-zinc-500 text-gray-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition"
                @click="reviewTagAddOpen = !reviewTagAddOpen"
                title="添加标签"
              >
                <i class="fa-solid fa-plus text-xs"></i>添加
              </button>
              <!-- 下拉搜索 -->
              <div
                v-if="reviewTagAddOpen"
                class="absolute z-30 left-0 top-full mt-1 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border dark:border-zinc-600 overflow-hidden"
              >
                <div class="px-2 py-1.5 border-b dark:border-zinc-600">
                  <input
                    ref="reviewTagSearchInputRef"
                    v-model="reviewTagSearch"
                    type="text"
                    placeholder="搜索或输入新标签名..."
                    class="w-full text-sm bg-transparent outline-none placeholder-gray-400"
                    @input="onReviewTagSearch"
                    @keydown.enter.prevent="onReviewTagSearchEnter"
                  />
                </div>
                <div class="max-h-44 overflow-y-auto">
                  <button
                    v-for="tag in reviewTagSearchResults"
                    :key="tag.id"
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
                    @click="addReviewTag(tag)"
                  >
                    <span class="w-2 h-2 rounded-full shrink-0" :style="tag.color ? { backgroundColor: tag.color } : { backgroundColor: '#9ca3af' }"></span>
                    <span>{{ tag.name }}</span>
                    <span v-if="tag.isNsfw" class="ml-auto text-[10px] font-bold text-amber-500">18+</span>
                  </button>
                  <button
                    v-if="reviewCanCreateNew"
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-blue-500 border-t dark:border-zinc-600"
                    @click="addReviewNewTag(reviewTagSearch.trim())"
                  >
                    <i class="fa-solid fa-plus text-xs"></i>
                    <span>创建「{{ reviewTagSearch.trim() }}」</span>
                  </button>
                  <div
                    v-if="!reviewTagSearchResults.length && !reviewCanCreateNew && reviewTagSearch"
                    class="px-3 py-2 text-sm text-gray-400"
                  >已添加</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">审核备注（可选）</label>
          <textarea
            v-model="reviewNote"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="3"
            :placeholder="reviewAction === 'approve' ? '可以添加一些说明...' : '请说明驳回原因...'"
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
            :disabled="reviewing"
            class="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
            :class="reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'"
          >
            {{ reviewing ? '处理中...' : (reviewAction === 'approve' ? '确认通过' : '确认驳回') }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { EditRequestItem, EditRequestsResponse, ReviewStatus, TagItem, TagMapEntry } from '~/types/api'
import { onClickOutside } from '@vueuse/core'

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
const currentRequest = ref<EditRequestItem | null>(null)
const selectedIds = ref<number[]>([])

const statusLabels: Record<ReviewStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const fieldLabels: Record<string, string> = {
  titleEn: '英文标题',
  titleJa: '日文标题',
  titleZhHans: '简体中文标题',
  titleZhHant: '繁体中文标题',
  descriptionEn: '英文简介',
  descriptionJa: '日文简介',
  descriptionZhHans: '简体中文简介',
  descriptionZhHant: '繁体中文简介',
  coverImage: '封面图片',
  releaseDate: '发售日期',
  companyId: '开发商',
  companies: '关联会社',
  isNsfw: 'NSFW',
  vndbId: 'VNDB ID',
  bangumiId: 'Bangumi ID',
  seriesId: '游戏系列',
  lengthMinutes: '游戏时长',
  aliases: '别名',
  purchaseLinks: '购买链接',
  tagIds: '标签',
  newTagNames: '新增标签',
  staff: '制作人员',
}

const roleLabels: Record<string, string> = {
  DEVELOPER: '开发商',
  PUBLISHER: '发行商',
}

// 获取请求列表
const { data, pending, refresh } = await useAuthFetch<EditRequestsResponse>('/api/admin/edit-requests', {
  key: 'admin-edit-requests',
  query: computed(() => ({
    page: page.value,
    status: filterStatus.value || undefined,
  })),
})

const requests = computed(() => data.value?.requests || [])
const totalPages = computed(() => data.value?.totalPages || 1)
const pendingCount = computed(() => data.value?.pendingCount || 0)
const pendingRequests = computed(() => requests.value.filter(r => r.status === 'PENDING'))
// 来自后端的 tagId → {name, color, isNsfw} 映射
const tagMap = computed<Record<number, TagMapEntry>>(() => (data.value?.tagMap as any) ?? {})

// 批量选择相关
const isAllSelected = computed(() => {
  if (!pendingRequests.value.length) return false
  return pendingRequests.value.every((r: any) => selectedIds.value.includes(r.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = pendingRequests.value.map((r: any) => r.id)
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
  if (!confirm(`确定要通过选中的 ${selectedIds.value.length} 个修改请求吗？`)) return
  
  try {
    await authFetch('/api/admin/edit-requests/batch', {
      method: 'POST',
      body: { ids: selectedIds.value, action: 'approve' },
    })
    toast.success(`已通过 ${selectedIds.value.length} 个请求`)
    selectedIds.value = []
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '批量操作失败')
  }
}

async function batchReject() {
  if (!confirm(`确定要驳回选中的 ${selectedIds.value.length} 个修改请求吗？`)) return
  
  try {
    await authFetch('/api/admin/edit-requests/batch', {
      method: 'POST',
      body: { ids: selectedIds.value, action: 'reject' },
    })
    toast.success(`已驳回 ${selectedIds.value.length} 个请求`)
    selectedIds.value = []
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '批量操作失败')
  }
}

function getGameTitle(game: any) {
  if (!game) return null
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return '(空)'
    if (typeof value[0] === 'object') {
      return value.map(v => {
        // 会社：名称（角色）
        if (v && v.companyId !== undefined) {
          const name = v.name || `#${v.companyId}`
          return v.role ? `${name}（${roleLabels[v.role] || v.role}）` : name
        }
        // STAFF：名称（角色）
        if (v && v.name !== undefined && v.role !== undefined && v.companyId === undefined) {
          return `${v.name}（${v.role}）`
        }
        return v.name || v.url || JSON.stringify(v)
      }).join('，')
    }
    return value.join(', ')
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value)
  // 识别 ISO 日期字符串，只显示日期部分
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(value)) {
    return value.slice(0, 10)
  }
  return String(value)
}

function showReviewModal(request: any, action: 'approve' | 'reject') {
  currentRequest.value = request
  reviewAction.value = action
  reviewNote.value = ''
  initReviewTags(request)
  reviewModalVisible.value = true
}

// ==================== 审核弹窗标签编辑 ====================

// 全量标签列表（用于弹窗搜索），懒加载
const allTagsCache = ref<TagItem[]>([])
async function ensureAllTags() {
  if (allTagsCache.value.length) return
  try {
    const res = await $fetch<{ items: TagItem[] }>('/api/tags', { query: { limit: 500 } })
    allTagsCache.value = res.items || []
  } catch {}
}

// 弹窗中的可编辑标签状态
const reviewTagIds = ref<Array<{ id: number; name: string; color: string | null; isNsfw: boolean }>>([])
const reviewNewTags = ref<Array<{ name: string; isNsfw: boolean; color?: string }>>([])
const reviewHasTags = computed(() => {
  if (!currentRequest.value?.changes) return false
  return 'tagIds' in currentRequest.value.changes || 'newTagNames' in currentRequest.value.changes
})

function initReviewTags(request: any) {
  reviewTagIds.value = []
  reviewNewTags.value = []
  if (!request?.changes) return

  // 已有标签 id → name（用 tagMap，fallback 到 #id）
  const ids: number[] = (request.changes.tagIds?.new as number[]) ?? []
  reviewTagIds.value = ids.map((id: number) => {
    const entry = tagMap.value[id]
    return {
      id,
      name: entry?.name ?? `#${id}`,
      color: entry?.color ?? null,
      isNsfw: entry?.isNsfw ?? false,
    }
  })

  // 待创建的新标签
  const names: string[] = (request.changes.newTagNames?.new as string[]) ?? []
  reviewNewTags.value = names.map(name => ({ name, isNsfw: false }))
}

function tagChipStyle(id: number) {
  const entry = tagMap.value[id]
  if (entry?.color) return { backgroundColor: entry.color + '20', color: entry.color }
  return { backgroundColor: 'rgba(107,114,128,0.12)', color: 'inherit' }
}

function tagName(id: number) {
  return tagMap.value[id]?.name ?? `#${id}`
}
function tagIsNsfw(id: number) {
  return tagMap.value[id]?.isNsfw ?? false
}

// 已提交标签的增删 diff（用于列表只读展示）
function removedTagIds(change: any): number[] {
  const oldIds: number[] = change.old ?? []
  const newIds: number[] = change.new ?? []
  const newSet = new Set(newIds)
  return oldIds.filter(id => !newSet.has(id))
}
function addedTagIds(change: any): number[] {
  const oldIds: number[] = change.old ?? []
  const newIds: number[] = change.new ?? []
  const oldSet = new Set(oldIds)
  return newIds.filter(id => !oldSet.has(id))
}
function keptTagIds(change: any): number[] {
  const oldIds: number[] = change.old ?? []
  const newIds: number[] = change.new ?? []
  const oldSet = new Set(oldIds)
  return newIds.filter(id => oldSet.has(id))
}

// 弹窗标签操作
function removeReviewTag(id: number) {
  reviewTagIds.value = reviewTagIds.value.filter(t => t.id !== id)
}
function removeReviewNewTag(name: string) {
  reviewNewTags.value = reviewNewTags.value.filter(t => t.name !== name)
}

async function toggleTagNsfw(tag: { id: number; name: string; color: string | null; isNsfw: boolean }) {
  if (tag.isNsfw) {
    // 取消 NSFW 也是全局操作，告知管理员
    if (!confirm(`取消「${tag.name}」的 NSFW 标记会影响所有使用该标签的条目，确认？`)) return
  } else {
    if (!confirm(`将「${tag.name}」标记为 NSFW 会影响所有使用该标签的条目，确认？`)) return
  }
  // 直接调用后端修改 Tag 全局属性
  try {
    await authFetch(`/api/admin/tags/${tag.id}`, {
      method: 'PUT',
      body: { isNsfw: !tag.isNsfw },
    })
    tag.isNsfw = !tag.isNsfw
    // 同步更新 tagMap 缓存，让列表展示也刷新
    if (tagMap.value[tag.id]) {
      tagMap.value[tag.id].isNsfw = tag.isNsfw
    }
    toast.success(`已${tag.isNsfw ? '标记' : '取消'} NSFW`)
  } catch (e: any) {
    toast.error(e.data?.message || '操作失败')
  }
}

// 弹窗内搜索添加标签
const reviewTagAddOpen = ref(false)
const reviewTagSearch = ref('')
const reviewTagSearchResults = ref<TagItem[]>([])
const reviewTagDropdownRef = ref<HTMLElement | null>(null)
const reviewTagSearchInputRef = ref<HTMLInputElement | null>(null)
let reviewTagSearchTimer: ReturnType<typeof setTimeout>

onClickOutside(reviewTagDropdownRef, () => {
  reviewTagAddOpen.value = false
  reviewTagSearch.value = ''
})

watch(reviewTagAddOpen, async (open) => {
  if (open) {
    await ensureAllTags()
    await nextTick()
    reviewTagSearchInputRef.value?.focus()
  }
})

function onReviewTagSearch() {
  clearTimeout(reviewTagSearchTimer)
  const q = reviewTagSearch.value.trim().toLowerCase()
  if (!q) {
    reviewTagSearchResults.value = []
    return
  }
  reviewTagSearchTimer = setTimeout(() => {
    const alreadyIds = new Set(reviewTagIds.value.map(t => t.id))
    reviewTagSearchResults.value = allTagsCache.value
      .filter(t =>
        t.name !== '机器翻译' &&
        t.name.toLowerCase().includes(q) &&
        !alreadyIds.has(t.id),
      )
      .slice(0, 8)
  }, 150)
}

const reviewCanCreateNew = computed(() => {
  const q = reviewTagSearch.value.trim()
  if (!q || q.length < 1 || q.length > 100) return false
  if (reviewTagIds.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  if (reviewNewTags.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  if (reviewTagSearchResults.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  return true
})

function addReviewTag(tag: TagItem) {
  if (reviewTagIds.value.some(t => t.id === tag.id)) return
  reviewTagIds.value.push({
    id: tag.id,
    name: tag.name,
    color: tag.color ?? null,
    isNsfw: tag.isNsfw ?? false,
  })
  reviewTagSearch.value = ''
  reviewTagSearchResults.value = []
  reviewTagAddOpen.value = false
}

function addReviewNewTag(name: string) {
  if (!name) return
  if (reviewNewTags.value.some(t => t.name.toLowerCase() === name.toLowerCase())) return
  reviewNewTags.value.push({ name, isNsfw: false })
  reviewTagSearch.value = ''
  reviewTagSearchResults.value = []
  reviewTagAddOpen.value = false
}

function onReviewTagSearchEnter() {
  const q = reviewTagSearch.value.trim()
  if (!q) return
  const exact = reviewTagSearchResults.value.find(t => t.name.toLowerCase() === q.toLowerCase())
  if (exact) {
    addReviewTag(exact)
  } else if (reviewCanCreateNew.value) {
    addReviewNewTag(q)
  }
}

async function handleReview() {
  if (!currentRequest.value) return

  reviewing.value = true
  try {
    // 如果有标签改动，携带 overrides
    const hasTagChange = reviewHasTags.value
    const body: Record<string, any> = {
      action: reviewAction.value,
      note: reviewNote.value || undefined,
    }

    if (reviewAction.value === 'approve' && hasTagChange) {
      body.overrides = {
        tagIds: reviewTagIds.value.map(t => t.id),
        newTags: reviewNewTags.value.length > 0 ? reviewNewTags.value : undefined,
      }
    }

    await authFetch(`/api/admin/edit-requests/${currentRequest.value.id}/review`, {
      method: 'POST',
      body,
    })
    toast.success(reviewAction.value === 'approve' ? '已通过，修改已应用' : '已驳回')
    reviewModalVisible.value = false
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    reviewing.value = false
  }
}

useHead({
  title: '条目修改审核 - 管理后台',
})
</script>

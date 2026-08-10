<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">举报管理</h1>
      
      <!-- 筛选栏 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">类型：</span>
            <select 
              v-model="filterType"
              class="px-3 py-1.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
            >
              <option value="">全部</option>
              <option value="COMMENT">评论举报</option>
              <option value="RESOURCE">资源举报</option>
              <option value="GUIDE">攻略举报</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">状态：</span>
            <select 
              v-model="filterStatus"
              class="px-3 py-1.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 text-sm"
            >
              <option value="">全部</option>
              <option value="PENDING">待处理</option>
              <option value="RESOLVED">已处理</option>
              <option value="REJECTED">已驳回</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 举报列表 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div v-if="pending" class="text-center py-12">
          <i class="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
        </div>
        
        <div v-else-if="!reports?.length" class="text-center py-12 text-gray-500">
          暂无举报
        </div>
        
        <div v-else class="divide-y dark:divide-zinc-700">
          <div 
            v-for="report in reports"
            :key="report.id"
            class="p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          >
            <div class="flex items-start gap-4">
              <div class="min-w-0 flex-1">
                <!-- 举报类型和状态 -->
                <div class="flex items-center gap-2 mb-2">
                  <span 
                    class="px-2 py-0.5 text-xs rounded"
                    :class="{
                      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400': report.type === 'COMMENT',
                      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400': report.type === 'RESOURCE',
                      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': report.type === 'GUIDE',
                    }"
                  >
                    {{ report.type === 'COMMENT' ? '评论' : report.type === 'RESOURCE' ? '资源' : '攻略' }}
                  </span>
                  <span 
                    class="px-2 py-0.5 text-xs rounded"
                    :class="{
                      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400': report.status === 'PENDING',
                      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': report.status === 'RESOLVED',
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': report.status === 'REJECTED',
                    }"
                  >
                    {{ statusLabels[report.status] }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ formatDate(report.createdAt) }}
                  </span>
                </div>
                
                <!-- 举报理由 -->
                <div class="text-sm mb-2">
                  <span class="text-gray-500">举报理由：</span>
                  <span class="font-medium">{{ report.reason }}</span>
                  <span v-if="report.detail" class="text-gray-500 ml-2">- {{ report.detail }}</span>
                </div>
                
                <!-- 举报人 -->
                <div class="text-xs text-gray-500 mb-2">
                  举报人：{{ report.reporter?.username }}
                </div>
                
                <!-- 被举报内容 -->
                <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-3 text-sm">
                  <template v-if="report.type === 'COMMENT' && report.comment">
                    <div class="flex items-center gap-2 mb-1 text-xs text-gray-500">
                      <span>评论者：{{ report.comment.user?.username }}</span>
                      <span>·</span>
                      <NuxtLink 
                        :to="`/games/${report.comment.gameId}`"
                        class="text-blue-500 hover:underline"
                      >
                        查看游戏
                      </NuxtLink>
                    </div>
                    <SafeHtml class="text-gray-700 dark:text-gray-300" :content="report.comment.content" />
                  </template>
                  <template v-else-if="report.type === 'RESOURCE' && report.resource">
                    <div class="flex items-center gap-2 mb-1 text-xs text-gray-500">
                      <span>资源：{{ report.resource.title }}</span>
                      <span>·</span>
                      <span>上传者：{{ report.resource.uploader?.username }}</span>
                      <span>·</span>
                      <NuxtLink 
                        :to="`/games/${report.resource.gameId}`"
                        class="text-blue-500 hover:underline"
                      >
                        查看游戏
                      </NuxtLink>
                    </div>
                    <div class="text-gray-700 dark:text-gray-300">
                      链接：<a :href="report.resource.url" target="_blank" class="break-all text-blue-500 hover:underline">{{ report.resource.url }}</a>
                    </div>
                  </template>
                  <template v-else-if="report.type === 'GUIDE' && report.guide">
                    <div class="flex items-center gap-2 mb-1 text-xs text-gray-500">
                      <span>攻略：{{ report.guide.title }}</span>
                      <span>·</span>
                      <span>作者：{{ report.guide.user?.username }}</span>
                      <span>·</span>
                      <NuxtLink 
                        :to="`/games/${report.guide.gameId}/guides`"
                        class="text-blue-500 hover:underline"
                      >
                        查看攻略页
                      </NuxtLink>
                    </div>
                    <SafeHtml class="text-gray-700 dark:text-gray-300 line-clamp-3" :content="report.guide.content" />
                  </template>
                  <div v-else class="text-gray-500">内容已被删除</div>
                </div>
                
                <!-- 处理信息 -->
                <div v-if="report.handledBy" class="mt-2 text-xs text-gray-500">
                  处理人：{{ report.handledBy.username }}
                  <span v-if="report.handleNote" class="ml-2">备注：{{ report.handleNote }}</span>
                </div>
              </div>
              
              <!-- 操作按钮 -->
              <div v-if="report.status === 'PENDING'" class="flex flex-col gap-2">
                <button 
                  @click="handleReport(report, 'delete')"
                  class="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  删除内容
                </button>
                <button 
                  v-if="report.type === 'RESOURCE'"
                  @click="openEditModal(report)"
                  class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  修改资源
                </button>
                <button 
                  @click="handleReport(report, 'reject')"
                  class="px-3 py-1.5 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                >
                  驳回举报
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
        <button 
          v-for="p in totalPages"
          :key="p"
          @click="page = p"
          class="px-3 py-1.5 rounded-lg text-sm transition"
          :class="p === page 
            ? 'bg-gray-800 dark:bg-zinc-600 text-white' 
            : 'border dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700'"
        >
          {{ p }}
        </button>
      </div>

    <!-- 修改资源弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showEditModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 w-[500px] shadow-xl modal-content">
            <h3 class="font-semibold mb-4">修改资源</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-500 mb-1">资源标题</label>
                <input 
                  v-model="editForm.title"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-500 mb-1">资源链接</label>
                <input 
                  v-model="editForm.url"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-500 mb-1">提取密码</label>
                <input 
                  v-model="editForm.extractCode"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-500 mb-1">解压密码</label>
                <input 
                  v-model="editForm.unzipPassword"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-500 mb-1">处理备注</label>
                <textarea 
                  v-model="editForm.handleNote"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
                  rows="2"
                ></textarea>
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <button 
                @click="showEditModal = false"
                class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                取消
              </button>
              <button 
                @click="submitEdit"
                :disabled="editSubmitting"
                class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {{ editSubmitting ? '保存中...' : '保存修改' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { ReportItem, ReportsResponse } from '~/types/api'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

const page = ref(1)
const filterType = ref('')
const filterStatus = ref('PENDING')

const statusLabels: Record<string, string> = {
  PENDING: '待处理',
  RESOLVED: '已处理',
  REJECTED: '已驳回',
}

function reportTypeLabel(type: string) {
  return type === 'COMMENT' ? '评论' : type === 'RESOURCE' ? '资源' : '攻略'
}

// 获取举报列表
const { data, pending, refresh } = await useAuthFetch<ReportsResponse>('/api/admin/reports', {
  key: 'admin-reports',
  query: computed(() => ({
    page: page.value,
    type: filterType.value || undefined,
    status: filterStatus.value || undefined,
  })),
})

const reports = computed(() => data.value?.reports || [])
const totalPages = computed(() => data.value?.totalPages || 1)

// 处理举报
async function handleReport(report: ReportItem, action: 'delete' | 'reject') {
  const confirmMsg = action === 'delete' 
    ? `确定要删除该${reportTypeLabel(report.type)}吗？`
    : '确定要驳回该举报吗？'
  
  if (!confirm(confirmMsg)) return

  try {
    await authFetch(`/api/admin/reports/${report.id}/handle`, {
      method: 'POST',
      body: { action },
    })
    toast.success(action === 'delete' ? '内容已删除' : '举报已驳回')
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  }
}

// 编辑资源弹窗
const showEditModal = ref(false)
const editSubmitting = ref(false)
const editingReport = ref<any>(null)
const editForm = ref({
  title: '',
  url: '',
  extractCode: '',
  unzipPassword: '',
  handleNote: '',
})

function openEditModal(report: any) {
  editingReport.value = report
  editForm.value = {
    title: report.resource?.title || '',
    url: report.resource?.url || '',
    extractCode: report.resource?.extractCode || '',
    unzipPassword: report.resource?.unzipPassword || '',
    handleNote: '',
  }
  showEditModal.value = true
}

async function submitEdit() {
  if (!editingReport.value || editSubmitting.value) return
  
  editSubmitting.value = true
  try {
    await authFetch(`/api/admin/reports/${editingReport.value.id}/handle`, {
      method: 'POST',
      body: {
        action: 'edit',
        resourceData: {
          title: editForm.value.title,
          url: editForm.value.url,
          extractCode: editForm.value.extractCode || null,
          unzipPassword: editForm.value.unzipPassword || null,
        },
        handleNote: editForm.value.handleNote,
      },
    })
    toast.success('资源已修改')
    showEditModal.value = false
    refresh()
  } catch (error: any) {
    toast.error(error.data?.message || '修改失败')
  } finally {
    editSubmitting.value = false
  }
}
</script>

<style scoped>
</style>

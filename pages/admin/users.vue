<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">用户管理</h1>

    <!-- 筛选 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-6">
      <div class="flex flex-wrap items-center gap-4">
        <div class="relative flex-1 min-w-[200px]">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索用户名或邮箱..." 
            class="w-full px-4 py-2 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            @keyup.enter="handleSearch"
          />
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>
        <select 
          v-model="roleFilter"
          class="px-4 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          @change="handleFilter"
        >
          <option value="">全部角色</option>
          <option value="USER">普通用户</option>
          <option value="EDITOR">编辑员</option>
          <option value="ADMIN">管理员</option>
        </select>
        <select 
          v-model="statusFilter"
          class="px-4 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600"
          @change="handleFilter"
        >
          <option value="">全部状态</option>
          <option value="ACTIVE">正常</option>
          <option value="BANNED">封禁</option>
        </select>
      </div>

      <div class="mt-4 pt-4 border-t dark:border-zinc-700 space-y-3">
        <div class="flex flex-wrap items-center gap-3">
          <button
            @click="loadAvatarScan"
            :disabled="avatarScanLoading || avatarScanRunning"
            class="px-4 py-2 bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition text-sm"
          >
            <i class="fa-solid fa-rotate mr-2"></i>{{ avatarScanLoading ? '扫描中...' : '扫描头像状态' }}
          </button>
          <button
            @click="startAvatarScan"
            :disabled="avatarScanRunning || avatarScanCandidates.length === 0"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
          >
            <i class="fa-solid fa-user-check mr-2"></i>{{ avatarScanRunning ? '处理中...' : '重新检测头像' }}
          </button>
          <span v-if="avatarScanSummary" class="text-sm text-gray-500 dark:text-gray-400">
            共 {{ avatarScanSummary.total }} 人，可处理 {{ avatarScanSummary.candidates }} 人，已跳过自定义头像 {{ avatarScanSummary.uploadedSkipped }} 人
          </span>
        </div>

        <div v-if="avatarScanRunning || avatarScanDone" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span>{{ avatarScanDone ? '已完成' : '处理中...' }} <strong>{{ avatarScanProgress }}</strong> / {{ avatarScanCandidates.length }}</span>
            <span class="text-gray-400 text-xs">更新 {{ avatarScanUpdated }} · 跳过 {{ avatarScanSkipped }} · 失败 {{ avatarScanFailed }}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="avatarScanDone ? 'bg-green-500' : 'bg-blue-500'"
              :style="{ width: avatarScanCandidates.length ? (avatarScanProgress / avatarScanCandidates.length * 100) + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <div v-if="avatarScanLogs.length" class="max-h-48 overflow-y-auto rounded-lg bg-gray-50 dark:bg-zinc-900/60 p-3 font-mono text-xs space-y-1">
          <div
            v-for="(entry, index) in avatarScanLogs"
            :key="index"
            :class="entry.type === 'error' ? 'text-red-500' : entry.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'"
          >
            <span class="text-gray-400 mr-2">[{{ entry.index }}/{{ avatarScanCandidates.length }}]</span>
            <span class="font-medium mr-1">{{ entry.label }}</span>
            <span>{{ entry.message }}</span>
          </div>
        </div>
      </div>
      
      <!-- 批量操作栏 -->
      <div v-if="selectedIds.length > 0" class="flex items-center gap-4 mt-4 pt-4 border-t dark:border-zinc-700">
        <span class="text-sm text-gray-500">已选择 {{ selectedIds.length }} 项</span>
        <button 
          @click="batchBan"
          class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          <i class="fa-solid fa-ban mr-1"></i>批量封禁
        </button>
        <button 
          @click="batchUnban"
          class="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          <i class="fa-solid fa-check mr-1"></i>批量解封
        </button>
        <button 
          @click="clearSelection"
          class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          取消选择
        </button>
      </div>
    </div>

    <!-- 用户列表 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th class="px-4 py-3 text-left">
              <input 
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="rounded border-gray-300 dark:border-zinc-600"
              />
            </th>
            <th class="px-4 py-3 text-left text-sm font-medium">用户</th>
            <th class="px-4 py-3 text-left text-sm font-medium">角色</th>
            <th class="px-4 py-3 text-left text-sm font-medium">状态</th>
            <th class="px-4 py-3 text-left text-sm font-medium">贡献</th>
            <th class="px-4 py-3 text-left text-sm font-medium">注册时间</th>
            <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y dark:divide-zinc-700">
          <tr v-for="user in usersData?.items" :key="user.id" class="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <td class="px-4 py-3">
              <input 
                type="checkbox"
                :checked="selectedIds.includes(user.id)"
                @change="toggleSelect(user.id)"
                class="rounded border-gray-300 dark:border-zinc-600"
              />
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                  <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" />
                  <i v-else class="fa-solid fa-user text-gray-400"></i>
                </div>
                <div>
                  <div class="font-medium">{{ user.username }}</div>
                  <div class="text-xs text-gray-500">{{ user.email }}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <select 
                :value="user.role"
                @change="updateUserRole(user.id, ($event.target as HTMLSelectElement).value)"
                class="px-2 py-1 rounded text-sm border dark:bg-zinc-700 dark:border-zinc-600"
              >
                <option value="USER">普通用户</option>
                <option value="EDITOR">编辑员</option>
                <option value="ADMIN">管理员</option>
              </select>
            </td>
            <td class="px-4 py-3">
              <span 
                class="px-2 py-1 text-xs rounded font-medium"
                :class="user.status === 'ACTIVE' 
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'"
              >
                {{ user.status === 'ACTIVE' ? '正常' : '封禁' }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              创建 {{ user.createdGamesCount }} · 评论 {{ user.commentsCount }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ formatDate(user.createdAt) }}
            </td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <NuxtLink 
                  :to="`/user/${user.id}`"
                  target="_blank"
                  class="text-blue-500 hover:text-blue-600 text-sm"
                >
                  查看
                </NuxtLink>
                <button 
                  @click="openEditModal(user)"
                  class="text-gray-500 hover:text-gray-600 text-sm"
                >
                  编辑
                </button>
                <button 
                  v-if="user.status === 'ACTIVE'"
                  @click="openBanModal(user)"
                  class="text-orange-500 hover:text-orange-600 text-sm"
                >
                  封禁
                </button>
                <button 
                  v-else
                  @click="updateUserStatus(user.id, 'ACTIVE')"
                  class="text-green-500 hover:text-green-600 text-sm"
                >
                  解封
                </button>
                <button 
                  @click="deleteUser(user.id, user.username)"
                  class="text-red-500 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!usersData?.items?.length" class="text-center text-gray-500 py-12">
        暂无用户数据
      </div>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="usersData && usersData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="usersData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />

    <!-- 封禁确认弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showBanModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showBanModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
              <h3 class="font-semibold">封禁用户</h3>
              <button @click="showBanModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="p-4 space-y-4">
              <p class="text-sm">确定要封禁用户 <strong>{{ banTarget?.username }}</strong> 吗？</p>
              <div class="space-y-2 bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-3">
                <p class="text-xs font-medium text-gray-500 mb-2">IP 黑名单操作（可选）</p>
                <label v-if="banTarget?.registrationIp" class="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" v-model="banForm.blacklistRegIp" class="rounded" />
                  <span>将注册 IP <span class="font-mono text-xs bg-gray-200 dark:bg-zinc-600 px-1 rounded">{{ banTarget.registrationIp }}</span> 加入黑名单</span>
                </label>
                <label v-if="banTarget?.lastLoginIp && banTarget.lastLoginIp !== banTarget.registrationIp" class="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" v-model="banForm.blacklistLoginIp" class="rounded" />
                  <span>将最近登录 IP <span class="font-mono text-xs bg-gray-200 dark:bg-zinc-600 px-1 rounded">{{ banTarget.lastLoginIp }}</span> 加入黑名单</span>
                </label>
                <p v-if="!banTarget?.registrationIp && !banTarget?.lastLoginIp" class="text-xs text-gray-400">该用户无 IP 记录</p>
              </div>
              <div class="flex justify-end gap-3">
                <button @click="showBanModal = false" class="px-4 py-2 rounded-lg border dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700">取消</button>
                <button @click="confirmBan" class="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600">确认封禁</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 编辑用户弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showEditModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          @click.self="showEditModal = false"
        >
          <div class="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg modal-content max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between p-4 border-b dark:border-zinc-700 flex-shrink-0">
              <h3 class="font-semibold">编辑用户</h3>
              <button @click="showEditModal = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <form @submit.prevent="handleEditSubmit" class="p-4 space-y-4 overflow-y-auto flex-1">
              <!-- IP 信息（只读） -->
              <div v-if="editForm.registrationIp || editForm.lastLoginIp" class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-3 text-xs space-y-1">
                <div v-if="editForm.registrationIp" class="flex items-center gap-2">
                  <span class="text-gray-500 w-20 shrink-0">注册 IP</span>
                  <span class="font-mono">{{ editForm.registrationIp }}</span>
                  <button type="button" @click="addIpToBlacklist(editForm.registrationIp!)" class="ml-auto text-red-500 hover:text-red-600">
                    <i class="fa-solid fa-ban"></i> 加黑名单
                  </button>
                </div>
                <div v-if="editForm.lastLoginIp" class="flex items-center gap-2">
                  <span class="text-gray-500 w-20 shrink-0">最近登录 IP</span>
                  <span class="font-mono">{{ editForm.lastLoginIp }}</span>
                  <button type="button" @click="addIpToBlacklist(editForm.lastLoginIp!)" class="ml-auto text-red-500 hover:text-red-600">
                    <i class="fa-solid fa-ban"></i> 加黑名单
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">用户名</label>
                <input 
                  v-model="editForm.username"
                  type="text" 
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  required
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">邮箱</label>
                <input 
                  v-model="editForm.email"
                  type="email" 
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  required
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">新密码（留空则不修改）</label>
                <input 
                  v-model="editForm.password"
                  type="password"
                  autocomplete="new-password"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="留空则不修改密码"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">简介</label>
                <textarea 
                  v-model="editForm.bio"
                  class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  rows="3"
                  placeholder="可选"
                ></textarea>
              </div>

              <!-- 用户头衔 -->
              <div>
                <label class="block text-sm font-medium mb-1">用户头衔</label>
                <div class="flex gap-2">
                  <input
                    v-model="editForm.title"
                    type="text"
                    maxlength="50"
                    class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="留空则不显示头衔"
                  />
                  <input
                    v-if="editForm.title"
                    v-model="editForm.titleColor"
                    type="color"
                    class="w-10 h-10 rounded-lg border dark:border-zinc-600 cursor-pointer p-0.5"
                    title="选择头衔颜色"
                  />
                </div>
                <p v-if="editForm.title" class="mt-1 text-xs text-gray-500">
                  预览：
                  <span
                    class="px-1.5 py-0.5 rounded text-[11px] font-medium"
                    :style="{ color: editForm.titleColor, border: `1px solid ${editForm.titleColor}` }"
                  >{{ editForm.title }}</span>
                </p>
              </div>

              <!-- 下载权限 -->
              <div class="pt-2 border-t dark:border-zinc-700">
                <label class="flex items-center justify-between cursor-pointer select-none">
                  <div>
                    <div class="text-sm font-medium">无限制下载</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">开启后该用户不受每日下载次数限制</div>
                  </div>
                  <div
                    @click="editForm.unlimitedDownload = !editForm.unlimitedDownload"
                    class="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                    :class="editForm.unlimitedDownload ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-600'"
                  >
                    <span
                      class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      :class="editForm.unlimitedDownload ? 'translate-x-5' : 'translate-x-0'"
                    ></span>
                  </div>
                </label>
              </div>

              <div class="pt-2 border-t dark:border-zinc-700 space-y-2">
                <button 
                  type="button"
                  @click="sendResetPasswordEmail"
                  :disabled="editLoading"
                  class="w-full px-4 py-2 rounded-lg border border-blue-500 text-blue-500 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                >
                  <i class="fa-solid fa-envelope mr-1"></i>发送重置密码邮件
                </button>
                
                <button 
                  type="button"
                  @click="logoutAllSessions"
                  :disabled="editLoading"
                  class="w-full px-4 py-2 rounded-lg border border-orange-500 text-orange-500 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50"
                >
                  <i class="fa-solid fa-right-from-bracket mr-1"></i>注销全部会话
                </button>
              </div>
              
              <div class="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  @click="showEditModal = false"
                  class="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  :disabled="editLoading"
                  class="px-4 py-2 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
                >
                  {{ editLoading ? '保存中...' : '保存' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { AdminUserItem, ListResponse } from '~/types/api'

interface AvatarScanUser {
  id: number
  username: string
  email: string
  avatar: string | null
  status: 'uploaded' | 'generated' | 'missing' | 'other'
  skipped: boolean
  nextAvatar: string | null
}

interface AvatarScanSummary {
  total: number
  candidates: number
  uploadedSkipped: number
  generated: number
  missing: number
  other: number
  users: AvatarScanUser[]
}

interface AvatarScanLog {
  index: number
  label: string
  message: string
  type: 'info' | 'success' | 'error'
}

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

const searchQuery = ref(route.query.search as string || '')
const roleFilter = ref(route.query.role as string || '')
const statusFilter = ref(route.query.status as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const selectedIds = ref<number[]>([])
const showEditModal = ref(false)
const editLoading = ref(false)
const editForm = reactive({
  id: 0,
  username: '',
  email: '',
  password: '',
  bio: '',
  title: '',
  titleColor: '#6366f1',
  registrationIp: null as string | null,
  lastLoginIp: null as string | null,
  unlimitedDownload: false,
})

const showBanModal = ref(false)
const banTarget = ref<AdminUserItem | null>(null)
const banForm = reactive({ blacklistRegIp: false, blacklistLoginIp: false })
const avatarScanLoading = ref(false)
const avatarScanRunning = ref(false)
const avatarScanDone = ref(false)
const avatarScanSummary = ref<AvatarScanSummary | null>(null)
const avatarScanCandidates = ref<AvatarScanUser[]>([])
const avatarScanLogs = ref<AvatarScanLog[]>([])
const avatarScanProgress = ref(0)
const avatarScanUpdated = ref(0)
const avatarScanSkipped = ref(0)
const avatarScanFailed = ref(0)

const { data: usersData, refresh } = await useAuthFetch<ListResponse<AdminUserItem>>('/api/admin/users', {
  key: 'admin-users',
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
    search: searchQuery.value || undefined,
    role: roleFilter.value || undefined,
    status: statusFilter.value || undefined,
  })),
})

// 批量选择相关
const isAllSelected = computed(() => {
  if (!usersData.value?.items?.length) return false
  return usersData.value.items.every(u => selectedIds.value.includes(u.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = usersData.value?.items?.map(u => u.id) || []
  }
}

function avatarStatusText(status: AvatarScanUser['status']) {
  const labels: Record<AvatarScanUser['status'], string> = {
    uploaded: '自定义头像',
    generated: '旧默认头像',
    missing: '无头像',
    other: '外部头像',
  }
  return labels[status]
}

function addAvatarScanLog(index: number, label: string, message: string, type: AvatarScanLog['type'] = 'info') {
  avatarScanLogs.value.push({ index, label, message, type })
}

async function loadAvatarScan() {
  avatarScanLoading.value = true
  avatarScanDone.value = false
  avatarScanLogs.value = []
  avatarScanProgress.value = 0
  avatarScanUpdated.value = 0
  avatarScanSkipped.value = 0
  avatarScanFailed.value = 0

  try {
    const result = await authFetch<AvatarScanSummary>('/api/admin/scan-avatars')
    avatarScanSummary.value = result
    avatarScanCandidates.value = result.users.filter(user => !user.skipped)
    toast.success(`扫描完成：可处理 ${result.candidates} 人，跳过自定义头像 ${result.uploadedSkipped} 人`)
  } catch (error: any) {
    toast.error(error.data?.message || '头像扫描失败')
  } finally {
    avatarScanLoading.value = false
  }
}

async function startAvatarScan() {
  if (!avatarScanCandidates.value.length) return
  if (!confirm(`确定为 ${avatarScanCandidates.value.length} 个用户重新检测头像吗？已上传自定义头像的用户不会被处理；无 Gravatar 的用户会恢复站内默认头像。`)) return

  avatarScanRunning.value = true
  avatarScanDone.value = false
  avatarScanLogs.value = []
  avatarScanProgress.value = 0
  avatarScanUpdated.value = 0
  avatarScanSkipped.value = 0
  avatarScanFailed.value = 0

  const list = avatarScanCandidates.value
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    const index = i + 1

    try {
      const result = await authFetch<{ skipped: boolean; changed?: boolean; message: string }>(`/api/admin/scan-avatars`, {
        method: 'POST',
        body: { userId: item.id },
      })

      if (result.skipped) {
        avatarScanSkipped.value++
        addAvatarScanLog(index, item.username, result.message, 'info')
      } else {
        if (result.changed) avatarScanUpdated.value++
        addAvatarScanLog(index, item.username, `${avatarStatusText(item.status)}：${result.message}`, 'success')
      }
    } catch (error: any) {
      avatarScanFailed.value++
      addAvatarScanLog(index, item.username, error.data?.message || '处理失败', 'error')
    }

    avatarScanProgress.value = index
    await new Promise(resolve => setTimeout(resolve, 120))
  }

  avatarScanRunning.value = false
  avatarScanDone.value = true
  await refresh()
  toast.success(`头像扫描完成：更新 ${avatarScanUpdated.value}，跳过 ${avatarScanSkipped.value}，失败 ${avatarScanFailed.value}`)
}

async function cleanupUser(userId: number, username: string) {
  if (!confirm(`确定要清理用户「${username}」的所有评论/数据吗？\n\n注意：不会回滚该用户对游戏条目的修改，但会清空其编辑记录。\n该操作不可恢复！`)) return

  try {
    const res = await authFetch<{ success: boolean; message: string; result?: Record<string, number> }>(`/api/admin/users/${userId}/cleanup`, {
      method: 'POST',
      body: { deleteMessages: true },
    })
    await refresh()

    const countText = res.result
      ? Object.entries(res.result)
          .map(([k, v]) => `${k}:${v}`)
          .join('，')
      : ''
    toast.success(`${res.message}${countText ? `（${countText}）` : ''}`)
  } catch (error: any) {
    toast.error(error.data?.message || '清理失败')
  }
}

function openEditModal(user: AdminUserItem) {
  editForm.id = user.id
  editForm.username = user.username
  editForm.email = user.email
  editForm.password = ''
  editForm.bio = user.bio || ''
  editForm.title = (user as any).title || ''
  editForm.titleColor = (user as any).titleColor || '#6366f1'
  editForm.registrationIp = user.registrationIp || null
  editForm.lastLoginIp = user.lastLoginIp || null
  editForm.unlimitedDownload = user.unlimitedDownload || false
  showEditModal.value = true
}

function openBanModal(user: any) {
  banTarget.value = user
  banForm.blacklistRegIp = false
  banForm.blacklistLoginIp = false
  showBanModal.value = true
}

async function confirmBan() {
  if (!banTarget.value) return
  const blacklistIps = banForm.blacklistRegIp || banForm.blacklistLoginIp
  try {
    await authFetch(`/api/admin/users/${banTarget.value.id}`, {
      method: 'PUT',
      body: { status: 'BANNED', blacklistIps },
    })
    await refresh()
    showBanModal.value = false
    toast.success(blacklistIps ? '已封禁用户并将 IP 加入黑名单' : '已封禁用户')
  } catch (error: any) {
    toast.error(error.data?.message || '封禁失败')
  }
}

async function addIpToBlacklist(ip: string) {
  if (!confirm(`确定将 ${ip} 加入 IP 黑名单吗？`)) return
  try {
    await authFetch('/api/admin/ip-blacklist', {
      method: 'POST',
      body: { ip, reason: `手动加入，关联用户 ${editForm.username}` },
    })
    toast.success(`${ip} 已加入黑名单`)
  } catch (e: any) {
    toast.error(e.data?.message || '操作失败')
  }
}

async function handleEditSubmit() {
  if (!editForm.username || !editForm.email) return
  
  editLoading.value = true
  try {
    await authFetch(`/api/admin/users/${editForm.id}/edit`, {
      method: 'PUT',
      body: {
        username: editForm.username,
        email: editForm.email,
        password: editForm.password || undefined,
        bio: editForm.bio || undefined,
        unlimitedDownload: editForm.unlimitedDownload,
        title: editForm.title || null,
        titleColor: editForm.title ? (editForm.titleColor || null) : null,
      },
    })
    await refresh()
    toast.success('用户信息已更新')
    showEditModal.value = false
  } catch (error: any) {
    toast.error(error.data?.message || '更新失败')
  } finally {
    editLoading.value = false
  }
}

async function sendResetPasswordEmail() {
  if (!confirm('确定要发送重置密码邮件吗？')) return
  
  editLoading.value = true
  try {
    await authFetch(`/api/admin/users/${editForm.id}/send-reset-email`, {
      method: 'POST',
    })
    toast.success('重置密码邮件已发送')
  } catch (error: any) {
    toast.error(error.data?.message || '发送失败')
  } finally {
    editLoading.value = false
  }
}

async function logoutAllSessions() {
  if (!confirm('确定要注销该用户的全部会话吗？')) return
  
  editLoading.value = true
  try {
    await authFetch(`/api/admin/users/${editForm.id}/logout-all`, {
      method: 'POST',
    })
    toast.success('已注销全部会话')
  } catch (error: any) {
    toast.error(error.data?.message || '操作失败')
  } finally {
    editLoading.value = false
  }
}

async function deleteUser(userId: number, username: string) {
  if (!confirm(`确定要删除用户「${username}」吗？\n\n这将删除该用户的全部信息和数据，该操作不可恢复！`)) return
  if (!confirm(`再次确认：真的要删除用户「${username}」的全部数据吗？`)) return

  try {
    await authFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    })
    await refresh()
    toast.success('用户已删除')
  } catch (error: any) {
    toast.error(error.data?.message || '删除失败')
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

async function batchBan() {
  if (!confirm(`确定要封禁选中的 ${selectedIds.value.length} 个用户吗？`)) return
  
  try {
    await authFetch('/api/admin/users/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, status: 'BANNED' },
    })
    await refresh()
    toast.success(`已封禁 ${selectedIds.value.length} 个用户`)
    selectedIds.value = []
  } catch (error: any) {
    toast.error(error.data?.message || '批量操作失败')
  }
}

async function batchUnban() {
  if (!confirm(`确定要解封选中的 ${selectedIds.value.length} 个用户吗？`)) return
  
  try {
    await authFetch('/api/admin/users/batch', {
      method: 'PUT',
      body: { ids: selectedIds.value, status: 'ACTIVE' },
    })
    await refresh()
    toast.success(`已解封 ${selectedIds.value.length} 个用户`)
    selectedIds.value = []
  } catch (error: any) {
    toast.error(error.data?.message || '批量操作失败')
  }
}

function handleSearch() {
  currentPage.value = 1
  updateUrl()
}

function handleFilter() {
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
}

function updateUrl() {
  router.push({
    query: {
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(roleFilter.value && { role: roleFilter.value }),
      ...(statusFilter.value && { status: statusFilter.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

async function updateUserRole(userId: number, role: string) {
  try {
    await authFetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: { role },
    })
    await refresh()
    toast.success('角色更新成功')
  } catch (error: any) {
    toast.error(error.data?.message || '更新失败')
  }
}

async function updateUserStatus(userId: number, status: string) {
  if (!confirm(`确定要${status === 'BANNED' ? '封禁' : '解封'}该用户吗？`)) return

  try {
    await authFetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: { status },
    })
    await refresh()
    toast.success(status === 'BANNED' ? '已封禁用户' : '已解封用户')
  } catch (error: any) {
    toast.error(error.data?.message || '更新失败')
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `用户管理 - ${siteName.value} 管理后台`),
})
</script>

<template>
  <div>
    <header class="mb-8 border-b border-gray-200 dark:border-zinc-700 pb-5">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon name="fa6-solid:screwdriver-wrench" />
        </div>
        <div>
          <h1 class="text-2xl font-bold">系统维护</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">扫描并修复数据库中的历史残留与数据一致性问题</p>
        </div>
      </div>
    </header>

    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">数据清理</h2>
      <span class="text-xs text-gray-400">永久删除前可先扫描确认</span>
    </div>
    <div class="space-y-4">
      <!-- 软删除资源清理 -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div class="p-4 sm:p-5 border-b dark:border-zinc-700">
          <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h2 class="font-semibold text-lg flex items-center gap-2">
                <Icon name="fa6-solid:trash-can" class="text-red-500" />
                清理已删除的资源数据
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                资源删除后数据仍保留在数据库中（软删除），此操作将永久清除这些残留数据，不可恢复。
              </p>
            </div>
            <AdminKumoButton
              variant="secondary"
              :disabled="loadingDeleted"
              @click="loadDeletedResources"
            >
              <Icon name="fa6-solid:rotate" :class="{ 'fa-spin': loadingDeleted }" />
              {{ loadingDeleted ? '查询中...' : '查询残留数据' }}
            </AdminKumoButton>
          </div>
        </div>

        <!-- 未查询 -->
        <div v-if="!queried" class="p-6 text-sm text-gray-400 text-center">
          点击「查询残留数据」开始扫描
        </div>

        <!-- 无残留 -->
        <div v-else-if="deletedResources.length === 0" class="p-6 text-sm text-green-600 dark:text-green-400 text-center">
          <Icon name="fa6-solid:circle-check" class="mr-1" />没有残留的已删除资源，数据库干净
        </div>

        <!-- 有残留 -->
        <template v-else>
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <Icon name="fa6-solid:triangle-exclamation" />
            共找到 <strong>{{ deletedResources.length }}</strong> 条软删除残留数据
          </div>

          <div class="divide-y dark:divide-zinc-700 max-h-96 overflow-y-auto">
            <div v-for="item in deletedResources" :key="item.id" class="px-5 py-3 flex items-start gap-3">
              <input type="checkbox" v-model="item.selected" class="mt-1 rounded border-gray-300 dark:border-zinc-600" />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-500 mb-0.5">
                  <NuxtLink :to="`/games/${item.gameId}`" class="text-blue-500 hover:underline" target="_blank">{{ item.gameTitle }}</NuxtLink>
                  · 资源 #{{ item.id }}
                  <span class="ml-2 text-xs text-gray-400">删除于 {{ formatDate(item.deletedAt) }}</span>
                </div>
                <div class="text-sm font-medium">{{ item.title }}</div>
                <div class="text-xs text-gray-400 truncate mt-0.5">{{ item.url }}</div>
              </div>
            </div>
          </div>

          <div class="p-4 border-t dark:border-zinc-700 flex items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" class="rounded" />
              全选（{{ selectedCount }}/{{ deletedResources.length }}）
            </label>
            <AdminKumoButton
              variant="danger"
              :disabled="selectedCount === 0 || purging"
              @click="confirmPurge"
            >
              <Icon name="fa6-solid:fire" />
              {{ purging ? '清理中...' : `永久删除所选 (${selectedCount})` }}
            </AdminKumoButton>
          </div>
        </template>
      </div>

      <!-- 空壳评论清理 -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div class="p-4 sm:p-5 border-b dark:border-zinc-700">
          <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h2 class="font-semibold text-lg flex items-center gap-2">
                <Icon name="fa6-solid:comment-slash" class="text-red-500" />
                清理空壳评论
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                历史遗留的空内容评论（正文实质为空，仅显示头像和用户名），此操作将永久删除，不可恢复。仍挂有有效回复的顶级评论会自动保留。
              </p>
            </div>
            <AdminKumoButton variant="secondary"
              class="w-full shrink-0 sm:w-auto"
              :disabled="loadingEmptyComments"
              @click="loadEmptyComments"
            >
              <Icon name="fa6-solid:rotate"  :class="{ 'fa-spin': loadingEmptyComments }" />
              {{ loadingEmptyComments ? '查询中...' : '查询空壳评论' }}
            </AdminKumoButton>
          </div>
        </div>

        <!-- 未查询 -->
        <div v-if="!emptyCommentsQueried" class="p-6 text-sm text-gray-400 text-center">
          点击「查询空壳评论」开始扫描
        </div>

        <!-- 无残留 -->
        <div v-else-if="emptyComments.length === 0" class="p-6 text-sm text-green-600 dark:text-green-400 text-center">
          <Icon name="fa6-solid:circle-check" class="mr-1" />没有空壳评论，数据库干净
        </div>

        <!-- 有残留 -->
        <template v-else>
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <Icon name="fa6-solid:triangle-exclamation" />
            共找到 <strong>{{ emptyComments.length }}</strong> 条空壳评论
          </div>

          <div class="divide-y dark:divide-zinc-700 max-h-96 overflow-y-auto">
            <div v-for="item in emptyComments" :key="item.id" class="px-5 py-3 flex items-start gap-3">
              <input type="checkbox" v-model="item.selected" class="mt-1 rounded border-gray-300 dark:border-zinc-600" />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-500 mb-0.5">
                  <NuxtLink :to="`/games/${item.gameId}`" class="text-blue-500 hover:underline" target="_blank">{{ item.gameTitle }}</NuxtLink>
                  · 评论 #{{ item.id }}
                  <span class="ml-2 px-1.5 py-0.5 text-[10px] rounded" :class="item.isReply ? 'bg-gray-100 dark:bg-zinc-700 text-gray-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'">
                    {{ item.isReply ? '回复' : '顶级评论' }}
                  </span>
                  <span class="ml-2 text-xs text-gray-400">发表于 {{ formatDate(item.createdAt) }}</span>
                </div>
                <div class="text-sm">
                  <span class="font-medium">{{ item.username }}</span>
                  <span class="text-gray-400 ml-2 italic">（空内容）</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 border-t dark:border-zinc-700 flex items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" :checked="allEmptySelected" @change="toggleAllEmpty" class="rounded" />
              全选（{{ selectedEmptyCount }}/{{ emptyComments.length }}）
            </label>
            <AdminKumoButton variant="danger"
              :disabled="selectedEmptyCount === 0 || purgingEmpty"
              @click="confirmPurgeEmpty"
            >
              <Icon name="fa6-solid:fire" />
              {{ purgingEmpty ? '清理中...' : `永久删除所选 (${selectedEmptyCount})` }}
            </AdminKumoButton>
          </div>
        </template>
      </div>

      <!-- 孤立动态记录清理 -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div class="p-4 sm:p-5 border-b dark:border-zinc-700">
          <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h2 class="font-semibold text-lg flex items-center gap-2">
                <Icon name="fa6-solid:broom" class="text-yellow-500" />
                清理孤立动态记录
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                攻略被删除后，其对应的动态记录（贡献榜、我的动态）可能仍残留在数据库中，此操作将一并清除这些孤立记录。
              </p>
            </div>
            <AdminKumoButton variant="secondary"
              class="w-full shrink-0 sm:w-auto"
              :disabled="cleaningActivity"
              @click="loadOrphanActivityCount"
            >
              <Icon name="fa6-solid:rotate"  :class="{ 'fa-spin': cleaningActivity }" />
              {{ cleaningActivity ? '查询中...' : '查询孤立记录' }}
            </AdminKumoButton>
          </div>
        </div>

        <!-- 未查询 -->
        <div v-if="activityQueried === null" class="p-6 text-sm text-gray-400 text-center">
          点击「查询孤立记录」开始扫描
        </div>

        <!-- 无残留 -->
        <div v-else-if="activityQueried === 0" class="p-6 text-sm text-green-600 dark:text-green-400 text-center">
          <Icon name="fa6-solid:circle-check" class="mr-1" />没有孤立的动态记录，数据库干净
        </div>

        <!-- 有残留 -->
        <template v-else-if="activityQueried > 0">
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <Icon name="fa6-solid:triangle-exclamation" />
            共找到 <strong>{{ activityQueried }}</strong> 条孤立动态记录（攻略已删除但记录仍存在）
          </div>
          <div class="p-4 border-t dark:border-zinc-700 flex justify-end">
            <AdminKumoButton variant="danger"
              :disabled="cleaningActivity"
              @click="confirmActivityCleanup"
            >
              <Icon name="fa6-solid:fire" />
              {{ cleaningActivity ? '清理中...' : `清理全部 (${activityQueried})` }}
            </AdminKumoButton>
          </div>
        </template>
      </div>
    </div>

    <div class="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">一致性修复</h2>
      <span class="text-xs text-gray-400">操作会保留业务数据，仅修正异常字段或关联</span>
    </div>
    <div class="space-y-4">

      <!-- 机器翻译标签一致性修复 -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div class="border-b p-4 dark:border-zinc-700 sm:p-5">
          <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-semibold">
                <Icon name="fa6-solid:language" class="text-amber-500" />
                机翻资源标签修复
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                查找没有已审核机翻资源但仍带有“机器翻译”标签的游戏，并移除错误的标签关联。
              </p>
            </div>
            <AdminKumoButton variant="secondary"
              class="w-full shrink-0 sm:w-auto"
              :disabled="checkingMachineTags || cleaningMachineTags"
              @click="previewMachineTranslationTags"
            >
              <Icon name="fa6-solid:rotate"  :class="{ 'fa-spin': checkingMachineTags }" />
              {{ checkingMachineTags ? '扫描中...' : '扫描异常标签' }}
            </AdminKumoButton>
          </div>
        </div>

        <div v-if="machineTagsQueried === null" class="p-6 text-center text-sm text-gray-400">
          点击「扫描异常标签」检查全部游戏资源
        </div>

        <div v-else-if="staleMachineTagGames.length === 0" class="p-6 text-center text-sm text-green-600 dark:text-green-400">
          <Icon name="fa6-solid:circle-check" class="mr-1" />机器翻译标签与资源状态一致
        </div>

        <template v-else>
          <div class="flex items-center gap-2 bg-yellow-50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            <Icon name="fa6-solid:triangle-exclamation" />
            共发现 <strong>{{ staleMachineTagGames.length }}</strong> 个游戏存在错误标签
          </div>
          <div class="max-h-72 divide-y overflow-y-auto dark:divide-zinc-700">
            <NuxtLink
              v-for="game in staleMachineTagGames"
              :key="game.id"
              :to="`/games/${game.id}`"
              target="_blank"
              class="flex items-center gap-3 px-5 py-3 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700/50"
            >
              <span class="w-14 shrink-0 text-right text-xs text-gray-400">#{{ game.id }}</span>
              <span class="min-w-0 flex-1 truncate font-medium">{{ game.title }}</span>
              <Icon name="fa6-solid:arrow-up-right-from-square" class="text-xs text-gray-300" />
            </NuxtLink>
          </div>
          <div class="flex justify-end border-t p-4 dark:border-zinc-700">
            <AdminKumoButton variant="primary"
              :disabled="cleaningMachineTags"
              @click="showMachineTagConfirm = true"
            >
              <Icon name="fa6-solid:wand-magic-sparkles" />
              {{ cleaningMachineTags ? '修复中...' : `移除错误标签 (${staleMachineTagGames.length})` }}
            </AdminKumoButton>
          </div>
        </template>
      </div>
      <!-- 邮箱大小写规范化 -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div class="p-4 sm:p-5 border-b dark:border-zinc-700">
          <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h2 class="font-semibold text-lg flex items-center gap-2">
                <Icon name="fa6-solid:at" class="text-blue-500" />
                邮箱大小写规范化
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                将数据库中所有含大写字母的邮箱统一转为小写。若小写版本已被其他账号占用则自动跳过（需手动处理）。
              </p>
            </div>
            <AdminKumoButton variant="secondary"
              class="w-full shrink-0 sm:w-auto"
              :disabled="checkingEmails"
              @click="previewNormalizeEmails"
            >
              <Icon name="fa6-solid:rotate"  :class="{ 'fa-spin': checkingEmails }" />
              {{ checkingEmails ? '扫描中...' : '扫描异常邮箱' }}
            </AdminKumoButton>
          </div>
        </div>

        <!-- 未扫描 -->
        <div v-if="emailNormalizeQueried === null" class="p-6 text-sm text-gray-400 text-center">
          点击「扫描异常邮箱」查看需要处理的账号
        </div>

        <!-- 全部正常 -->
        <div v-else-if="emailsToNormalize.length === 0" class="p-6 text-sm text-green-600 dark:text-green-400 text-center">
          <Icon name="fa6-solid:circle-check" class="mr-1" />所有邮箱已是小写格式，无需处理
        </div>

        <!-- 有需处理项 -->
        <template v-else>
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
            <Icon name="fa6-solid:triangle-exclamation" />
            共发现 <strong>{{ emailsToNormalize.length }}</strong> 个含大写字母的邮箱
          </div>
          <div class="max-h-60 divide-y overflow-auto dark:divide-zinc-700">
            <div v-for="item in emailsToNormalize" :key="item.id" class="flex min-w-max items-center gap-3 px-5 py-2.5 text-sm">
              <span class="text-gray-500 w-6 text-right shrink-0">#{{ item.id }}</span>
              <span class="font-medium">{{ item.username }}</span>
              <span class="text-gray-400 mx-1">·</span>
              <code class="text-orange-500 dark:text-orange-400">{{ item.email }}</code>
              <Icon name="fa6-solid:arrow-right" class="text-gray-300 text-xs mx-1" />
              <code class="text-green-600 dark:text-green-400">{{ item.email.toLowerCase() }}</code>
            </div>
          </div>
          <div class="p-4 border-t dark:border-zinc-700 flex justify-end">
            <AdminKumoButton variant="primary"
              :disabled="normalizingEmails"
              @click="runNormalizeEmails"
            >
              <Icon name="fa6-solid:wand-magic-sparkles" />
              {{ normalizingEmails ? '处理中...' : `一键转为小写 (${emailsToNormalize.length})` }}
            </AdminKumoButton>
          </div>
        </template>
      </div>
    </div>

    <!-- 确认对话框 -->
    <Teleport to="body">
      <div v-if="showConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showConfirm = false"></div>
        <div class="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 class="font-semibold text-lg mb-2">确认永久删除</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
            即将永久删除 <strong class="text-red-500">{{ selectedCount }}</strong> 条资源数据，此操作不可恢复，是否继续？
          </p>
          <div class="flex justify-end gap-3">
            <AdminKumoButton variant="secondary"
              @click="showConfirm = false"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="danger"
              @click="executePurge"
            >
              确认删除
            </AdminKumoButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认对话框（空壳评论清理） -->
    <Teleport to="body">
      <div v-if="showEmptyConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showEmptyConfirm = false"></div>
        <div class="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 class="font-semibold text-lg mb-2">确认永久删除</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
            即将永久删除 <strong class="text-red-500">{{ selectedEmptyCount }}</strong> 条空壳评论，此操作不可恢复，是否继续？
          </p>
          <div class="flex justify-end gap-3">
            <AdminKumoButton variant="secondary"
              @click="showEmptyConfirm = false"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="danger"
              @click="executePurgeEmpty"
            >
              确认删除
            </AdminKumoButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认对话框（动态记录清理） -->
    <Teleport to="body">
      <div v-if="showActivityConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showActivityConfirm = false"></div>
        <div class="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 class="font-semibold text-lg mb-2">确认清理孤立记录</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
            即将清理 <strong class="text-red-500">{{ activityQueried }}</strong> 条孤立动态记录，此操作不可恢复，是否继续？
          </p>
          <div class="flex justify-end gap-3">
            <AdminKumoButton variant="secondary"
              @click="showActivityConfirm = false"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="danger"
              @click="executeActivityCleanup"
            >
              确认清理
            </AdminKumoButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认对话框（机器翻译标签修复） -->
    <Teleport to="body">
      <div v-if="showMachineTagConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50" @click="showMachineTagConfirm = false"></div>
        <div class="relative mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
          <h3 class="mb-2 text-lg font-semibold">确认修复机器翻译标签</h3>
          <p class="mb-5 text-sm text-gray-500 dark:text-gray-400">
            即将从 <strong class="text-amber-600 dark:text-amber-400">{{ staleMachineTagGames.length }}</strong> 个没有有效机翻资源的游戏中移除“机器翻译”标签。
          </p>
          <div class="flex justify-end gap-3">
            <AdminKumoButton variant="secondary"
              @click="showMachineTagConfirm = false"
            >
              取消
            </AdminKumoButton>
            <AdminKumoButton variant="primary"
              @click="runMachineTranslationTagCleanup"
            >
              确认修复
            </AdminKumoButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { authFetch } = useAuthRequest()
const toast = useToast()
const { formatDate } = useFormatDate()

interface DeletedResource {
  id: number
  title: string
  url: string
  gameId: number
  gameTitle: string
  deletedAt: string
  selected: boolean
}

const queried = ref(false)
const loadingDeleted = ref(false)
const purging = ref(false)
const showConfirm = ref(false)
const deletedResources = ref<DeletedResource[]>([])

// 孤立动态记录清理
const activityQueried = ref<number | null>(null)
const cleaningActivity = ref(false)
const showActivityConfirm = ref(false)

// 邮箱大小写规范化
interface EmailUser { id: number; username: string; email: string }
const emailNormalizeQueried = ref<boolean | null>(null)
const emailsToNormalize = ref<EmailUser[]>([])
const checkingEmails = ref(false)
const normalizingEmails = ref(false)

// 机器翻译标签一致性修复
interface StaleMachineTagGame { id: number; title: string }
const machineTagsQueried = ref<boolean | null>(null)
const staleMachineTagGames = ref<StaleMachineTagGame[]>([])
const checkingMachineTags = ref(false)
const cleaningMachineTags = ref(false)
const showMachineTagConfirm = ref(false)

const allSelected = computed(() => deletedResources.value.length > 0 && deletedResources.value.every(r => r.selected))
const selectedCount = computed(() => deletedResources.value.filter(r => r.selected).length)

function toggleAll() {
  const val = !allSelected.value
  deletedResources.value.forEach(r => r.selected = val)
}

async function loadDeletedResources() {
  loadingDeleted.value = true
  try {
    const data = await authFetch<{ total: number; resources: Omit<DeletedResource, 'selected'>[] }>('/api/admin/resources/deleted')
    deletedResources.value = data.resources.map(r => ({ ...r, selected: false }))
    queried.value = true
    if (data.total === 0) {
      toast.success('没有残留的已删除资源')
    } else {
      toast.info(`找到 ${data.total} 条软删除残留数据`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '查询失败')
  } finally {
    loadingDeleted.value = false
  }
}

function confirmPurge() {
  if (selectedCount.value === 0) return
  showConfirm.value = true
}

async function executePurge() {
  showConfirm.value = false
  const ids = deletedResources.value.filter(r => r.selected).map(r => r.id)
  if (!ids.length) return

  purging.value = true
  try {
    const result = await authFetch<{ count: number; message: string }>('/api/admin/resources/purge', {
      method: 'POST',
      body: { ids },
    })
    toast.success(result.message)
    deletedResources.value = deletedResources.value.filter(r => !ids.includes(r.id))
  } catch (error: any) {
    toast.error(error.data?.message || '清理失败')
  } finally {
    purging.value = false
  }
}

// 空壳评论清理
interface EmptyComment {
  id: number
  isReply: boolean
  createdAt: string
  username: string
  gameId: number
  gameTitle: string
  selected: boolean
}

const emptyCommentsQueried = ref(false)
const loadingEmptyComments = ref(false)
const purgingEmpty = ref(false)
const showEmptyConfirm = ref(false)
const emptyComments = ref<EmptyComment[]>([])

const allEmptySelected = computed(() => emptyComments.value.length > 0 && emptyComments.value.every(c => c.selected))
const selectedEmptyCount = computed(() => emptyComments.value.filter(c => c.selected).length)

function toggleAllEmpty() {
  const val = !allEmptySelected.value
  emptyComments.value.forEach(c => c.selected = val)
}

async function loadEmptyComments() {
  loadingEmptyComments.value = true
  try {
    const data = await authFetch<{ total: number; comments: Omit<EmptyComment, 'selected'>[] }>('/api/admin/comments/empty')
    emptyComments.value = data.comments.map(c => ({ ...c, selected: false }))
    emptyCommentsQueried.value = true
    if (data.total === 0) {
      toast.success('没有空壳评论')
    } else {
      toast.info(`找到 ${data.total} 条空壳评论`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '查询失败')
  } finally {
    loadingEmptyComments.value = false
  }
}

function confirmPurgeEmpty() {
  if (selectedEmptyCount.value === 0) return
  showEmptyConfirm.value = true
}

async function executePurgeEmpty() {
  showEmptyConfirm.value = false
  const ids = emptyComments.value.filter(c => c.selected).map(c => c.id)
  if (!ids.length) return

  purgingEmpty.value = true
  try {
    const result = await authFetch<{ count: number; message: string }>('/api/admin/comments/purge-empty', {
      method: 'POST',
      body: { ids },
    })
    toast.success(result.message)
    emptyComments.value = emptyComments.value.filter(c => !ids.includes(c.id))
  } catch (error: any) {
    toast.error(error.data?.message || '清理失败')
  } finally {
    purgingEmpty.value = false
  }
}

async function loadOrphanActivityCount() {
  cleaningActivity.value = true
  try {
    const data = await authFetch<{ count: number }>('/api/admin/activity/orphan-count')
    activityQueried.value = data.count
    if (data.count === 0) {
      toast.success('没有孤立的动态记录')
    } else {
      toast.info(`找到 ${data.count} 条孤立动态记录`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '查询失败')
  } finally {
    cleaningActivity.value = false
  }
}

function confirmActivityCleanup() {
  showActivityConfirm.value = true
}

async function executeActivityCleanup() {
  showActivityConfirm.value = false
  cleaningActivity.value = true
  try {
    const result = await authFetch<{ count: number; message: string }>('/api/admin/activity/cleanup', { method: 'POST' })
    toast.success(result.message)
    activityQueried.value = 0
  } catch (error: any) {
    toast.error(error.data?.message || '清理失败')
  } finally {
    cleaningActivity.value = false
  }
}

async function previewNormalizeEmails() {
  checkingEmails.value = true
  try {
    const data = await authFetch<{ users: EmailUser[] }>('/api/admin/maintenance/preview-emails')
    emailsToNormalize.value = data.users
    emailNormalizeQueried.value = true
    if (data.users.length === 0) {
      toast.success('所有邮箱已是小写，无需处理')
    } else {
      toast.info(`发现 ${data.users.length} 个需要规范化的邮箱`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '扫描失败')
  } finally {
    checkingEmails.value = false
  }
}

async function runNormalizeEmails() {
  normalizingEmails.value = true
  try {
    const result = await authFetch<{ count: number; skipped: number; message: string }>(
      '/api/admin/maintenance/normalize-emails',
      { method: 'POST' },
    )
    toast.success(result.message)
    emailsToNormalize.value = []
    emailNormalizeQueried.value = true
  } catch (error: any) {
    toast.error(error.data?.message || '处理失败')
  } finally {
    normalizingEmails.value = false
  }
}

async function previewMachineTranslationTags() {
  checkingMachineTags.value = true
  try {
    const data = await authFetch<{ count: number; games: StaleMachineTagGame[] }>(
      '/api/admin/maintenance/preview-machine-translation-tags',
    )
    staleMachineTagGames.value = data.games
    machineTagsQueried.value = true
    if (data.count === 0) {
      toast.success('机器翻译标签与资源状态一致')
    } else {
      toast.info(`发现 ${data.count} 个游戏存在错误标签`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '扫描失败')
  } finally {
    checkingMachineTags.value = false
  }
}

async function runMachineTranslationTagCleanup() {
  showMachineTagConfirm.value = false
  cleaningMachineTags.value = true
  try {
    const result = await authFetch<{ count: number; message: string }>(
      '/api/admin/maintenance/cleanup-machine-translation-tags',
      { method: 'POST' },
    )
    toast.success(result.message)
    staleMachineTagGames.value = []
    machineTagsQueried.value = true
  } catch (error: any) {
    toast.error(error.data?.message || '修复失败')
  } finally {
    cleaningMachineTags.value = false
  }
}

useHead({ title: '系统维护 - 管理后台' })
</script>

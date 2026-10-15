<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">批量补全信息</h1>

    <!-- VNDB 会社专项补全 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6 space-y-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <Icon name="fa6-solid:building" class="text-gray-400" />
            VNDB 会社补全
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            扫描所有带 VNDB ID 且没有会社关联的游戏。优先按名称、原名和别名匹配已有会社，未匹配到时自动创建并关联为开发商。
          </p>
        </div>
        <AdminKumoButton variant="primary"
          @click="startCompanyFill"
          :disabled="loadingCompanies || companyRunning || running || missingCompanyGames.length === 0"
          class="shrink-0"
        >
          <Icon :name="companyRunning ? 'fa6-solid:spinner' : 'fa6-solid:magnifying-glass'" :class="{ 'fa-spin': companyRunning }" />
          {{ companyRunning ? '扫描补全中...' : '扫描并补全缺失会社' }}
        </AdminKumoButton>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg bg-gray-50 dark:bg-zinc-700/50 px-4 py-3">
          <div class="text-xs text-gray-400">有 VNDB ID</div>
          <div class="mt-1 text-xl font-semibold">{{ companyScanTotal }}</div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-zinc-700/50 px-4 py-3">
          <div class="text-xs text-gray-400">缺失会社</div>
          <div class="mt-1 text-xl font-semibold text-orange-500">{{ missingCompanyGames.length }}</div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-zinc-700/50 px-4 py-3">
          <div class="text-xs text-gray-400">匹配已有会社</div>
          <div class="mt-1 text-xl font-semibold">{{ companyMatched }}</div>
        </div>
        <div class="rounded-lg bg-gray-50 dark:bg-zinc-700/50 px-4 py-3">
          <div class="text-xs text-gray-400">自动创建会社</div>
          <div class="mt-1 text-xl font-semibold text-green-600 dark:text-green-400">{{ companyCreated }}</div>
        </div>
      </div>

      <div v-if="loadingCompanies" class="text-sm text-gray-400">
        <Icon name="fa6-solid:spinner" class="fa-spin mr-1" />正在扫描缺失会社的游戏...
      </div>

      <div v-if="companyRunning || companyDone">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{{ companyDone ? '会社补全完成' : '正在处理' }}：<strong>{{ companyProgress }}</strong> / {{ companyTaskTotal }}</span>
          <span class="text-xs text-gray-400">
            已关联 {{ companyLinked }} 个 · 无开发商 {{ companyNoDevelopers }} 个 · 跳过 {{ companySkipped }} 个 · 失败 {{ companyFailed }} 个
          </span>
        </div>
        <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-700">
          <div
            class="h-2 rounded-full transition-all duration-300"
            :class="companyDone ? 'bg-green-500' : 'bg-gray-800 dark:bg-zinc-400'"
            :style="{ width: companyTaskTotal ? `${companyProgress / companyTaskTotal * 100}%` : '0%' }"
          ></div>
        </div>
      </div>

      <div v-if="companyLogs.length" class="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div class="px-4 py-2 border-b border-gray-200 dark:border-zinc-700 text-sm font-medium">会社补全日志</div>
        <div ref="companyLogContainerRef" class="max-h-64 overflow-y-auto p-3 font-mono text-xs space-y-1">
          <div
            v-for="(entry, index) in companyLogs"
            :key="index"
            :class="entry.type === 'error' ? 'text-red-500' : entry.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'"
          >
            <span class="text-gray-400 mr-2">[{{ entry.index }}/{{ companyTaskTotal }}]</span>
            <span class="font-medium mr-1">{{ entry.label }}</span>
            <span>{{ entry.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 说明 + 操作栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6 space-y-5">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        对站内所有已关联 VNDB ID 的游戏，通过 VNDB API 补全制作人员、会社和原始标签。无 VNDB ID 的游戏自动忽略。
      </p>

      <!-- 勾选项 -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" v-model="onlyMissingStaff" :disabled="running || companyRunning" class="rounded" />
          <span>仅处理<strong>没有制作人员</strong> 的游戏（已有制作人员的跳过）</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" v-model="onlyMissingCompany" :disabled="running || companyRunning" class="rounded" />
          <span>仅处理<strong>没有会社</strong> 的游戏（已有会社关联的跳过）</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" v-model="onlyMissingTags" :disabled="running || companyRunning" class="rounded" />
          <span>仅处理<strong>尚未同步 VNDB 标签</strong> 的游戏</span>
        </label>
      </div>

      <!-- 待处理数量提示 -->
      <div v-if="!running && !done" class="flex items-center gap-4 flex-wrap">
        <div v-if="loading" class="text-sm text-gray-400">
          <Icon name="fa6-solid:spinner" class="fa-spin mr-1" />加载中...
        </div>
        <template v-else>
          <div class="text-sm text-gray-500">
            共 <strong>{{ gameList.length }}</strong> 条有 VNDB ID，符合条件：<strong>{{ filteredGames.length }}</strong> 条
          </div>
          <div v-if="filteredGames.length === 0 && gameList.length > 0" class="text-sm text-yellow-600 dark:text-yellow-400">
            <Icon name="fa6-solid:triangle-exclamation" class="mr-1" />当前筛选条件下无可处理的游戏
          </div>
        </template>
        <AdminKumoButton variant="primary"
          @click="startFill"
          :disabled="running || companyRunning || filteredGames.length === 0"
        >
          <Icon name="fa6-solid:wand-magic-sparkles" />开始补全
        </AdminKumoButton>
      </div>

      <!-- 进度条 -->
      <div v-if="running || done">
        <div class="flex items-center justify-between text-sm mb-2">
          <span>
            {{ done ? '已完成' : '处理中...' }}
            <strong>{{ progress }}</strong> / {{ filteredGames.length }}
          </span>
          <span class="text-gray-400 text-xs">
            制作人员 +{{ totalStaff }} &nbsp;|&nbsp; 会社匹配 {{ totalCompanies }} &nbsp;|&nbsp; 原始标签 {{ totalTags }} &nbsp;|&nbsp; 中文标签 {{ totalApplied }} &nbsp;|&nbsp; 待映射 {{ totalPending }} &nbsp;|&nbsp; 失败 {{ totalFailed }}
          </span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-300"
            :class="done ? 'bg-green-500' : 'bg-blue-500'"
            :style="{ width: filteredGames.length ? (progress / filteredGames.length * 100) + '%' : '0%' }"
          ></div>
        </div>
        <div v-if="done" class="mt-3">
          <AdminKumoButton variant="secondary"
            @click="reset"
          >
            重置
          </AdminKumoButton>
        </div>
      </div>
    </div>

    <!-- 实时日志 -->
    <div v-if="logs.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
      <div class="px-6 py-3 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
        <h3 class="font-semibold text-sm">处理日志</h3>
        <span class="text-xs text-gray-400">{{ logs.length }} 条</span>
      </div>
      <div
        ref="logContainerRef"
        class="p-4 max-h-[60vh] overflow-y-auto font-mono text-xs space-y-1"
      >
        <div
          v-for="(entry, i) in logs"
          :key="i"
          :class="entry.type === 'error' ? 'text-red-500' : entry.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'"
        >
          <span class="text-gray-400 mr-2 select-none">[{{ entry.index }}/{{ filteredGames.length }}]</span>
          <span class="font-medium mr-1">{{ entry.label }}</span>
          <span>{{ entry.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { authFetch } = useAuthRequest()
const toast = useToast()

interface Game {
  id: number
  vndbId: string
  titleZhHans: string | null
  titleJa: string | null
  titleEn: string | null
  hasStaff: boolean
  hasCompany: boolean
  hasVndbTags: boolean
  vndbTagsSyncedAt: string | null
}

interface CompanyGame {
  id: number
  vndbId: string
  titleZhHans: string | null
  titleJa: string | null
  titleEn: string | null
}

interface LogEntry {
  index: number
  label: string
  message: string
  type: 'info' | 'success' | 'error'
}

interface CompanyScanResult {
  totalWithVndbId: number
  missingCompanyCount: number
  games: CompanyGame[]
}

const loading = ref(false)
const running = ref(false)
const done = ref(false)
const gameList = ref<Game[]>([])
const onlyMissingStaff = ref(false)
const onlyMissingCompany = ref(false)
const onlyMissingTags = ref(false)
const progress = ref(0)
const totalStaff = ref(0)
const totalCompanies = ref(0)
const totalTags = ref(0)
const totalApplied = ref(0)
const totalPending = ref(0)
const totalSkipped = ref(0)
const totalFailed = ref(0)
const logs = ref<LogEntry[]>([])
const logContainerRef = ref<HTMLElement>()
const loadingCompanies = ref(false)
const companyRunning = ref(false)
const companyDone = ref(false)
const companyScanTotal = ref(0)
const missingCompanyGames = ref<CompanyGame[]>([])
const companyProgress = ref(0)
const companyTaskTotal = ref(0)
const companyMatched = ref(0)
const companyCreated = ref(0)
const companyLinked = ref(0)
const companyNoDevelopers = ref(0)
const companySkipped = ref(0)
const companyFailed = ref(0)
const companyLogs = ref<LogEntry[]>([])
const companyLogContainerRef = ref<HTMLElement>()

// 根据勾选过滤出实际要处理的游戏
const filteredGames = computed(() => {
  return gameList.value.filter(g => {
    if (onlyMissingStaff.value && g.hasStaff) return false
    if (onlyMissingCompany.value && g.hasCompany) return false
    if (onlyMissingTags.value && g.hasVndbTags) return false
    return true
  })
})

function gameLabel(g: CompanyGame) {
  return g.titleZhHans || g.titleJa || g.titleEn || `#${g.id}`
}

async function loadGames() {
  loading.value = true
  try {
    const result = await authFetch('/api/admin/fill-info') as any
    gameList.value = result.games
  } catch (e: any) {
    toast.error(e.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMissingCompanyGames() {
  loadingCompanies.value = true
  try {
    const result = await authFetch('/api/admin/fill-companies') as CompanyScanResult
    companyScanTotal.value = result.totalWithVndbId
    missingCompanyGames.value = result.games
  } catch (e: any) {
    toast.error(e.data?.message || '扫描缺失会社失败')
  } finally {
    loadingCompanies.value = false
  }
}

function addLog(index: number, label: string, message: string, type: LogEntry['type'] = 'info') {
  logs.value.push({ index, label, message, type })
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

function addCompanyLog(index: number, label: string, message: string, type: LogEntry['type'] = 'info') {
  companyLogs.value.push({ index, label, message, type })
  nextTick(() => {
    if (companyLogContainerRef.value) {
      companyLogContainerRef.value.scrollTop = companyLogContainerRef.value.scrollHeight
    }
  })
}

async function startCompanyFill() {
  const list = [...missingCompanyGames.value]
  if (!list.length || companyRunning.value || running.value) return
  if (!confirm(`将扫描并处理 ${list.length} 个缺失会社的游戏。VNDB 中存在但站内未匹配的会社会自动创建，是否继续？`)) return

  companyRunning.value = true
  companyDone.value = false
  companyProgress.value = 0
  companyTaskTotal.value = list.length
  companyMatched.value = 0
  companyCreated.value = 0
  companyLinked.value = 0
  companyNoDevelopers.value = 0
  companySkipped.value = 0
  companyFailed.value = 0
  companyLogs.value = []

  for (let i = 0; i < list.length; i++) {
    const game = list[i]
    const index = i + 1
    const label = gameLabel(game)

    try {
      const result = await authFetch('/api/admin/fill-companies', {
        method: 'POST',
        body: { gameId: game.id },
      }) as any

      if (result.skipped) {
        companySkipped.value++
        addCompanyLog(index, label, result.reason || '已跳过')
      } else if (!result.developersFound) {
        companyNoDevelopers.value++
        addCompanyLog(index, label, 'VNDB 没有提供开发商数据')
      } else {
        companyMatched.value += result.companiesMatched || 0
        companyCreated.value += result.companiesCreated || 0
        companyLinked.value += result.companiesLinked || 0

        const details: string[] = []
        if (result.matchedNames?.length) details.push(`匹配：${result.matchedNames.join('、')}`)
        if (result.createdNames?.length) details.push(`新建：${result.createdNames.join('、')}`)
        details.push(`关联 ${result.companiesLinked || 0} 个开发商`)
        addCompanyLog(index, label, details.join('；'), 'success')
      }
    } catch (e: any) {
      companyFailed.value++
      addCompanyLog(index, label, `失败：${e.data?.message || e.message || '未知错误'}`, 'error')
    }

    companyProgress.value = index
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  companyRunning.value = false
  companyDone.value = true
  await Promise.all([loadMissingCompanyGames(), loadGames()])
  toast.success(`会社补全完成：关联 ${companyLinked.value} 个，自动创建 ${companyCreated.value} 个，失败 ${companyFailed.value} 个`)
}

async function startFill() {
  running.value = true
  done.value = false
  progress.value = 0
  totalStaff.value = 0
  totalCompanies.value = 0
  totalTags.value = 0
  totalApplied.value = 0
  totalPending.value = 0
  totalSkipped.value = 0
  totalFailed.value = 0
  logs.value = []

  const list = filteredGames.value

  for (let i = 0; i < list.length; i++) {
    const game = list[i]
    const label = gameLabel(game)
    const idx = i + 1

    // 计算本条游戏实际要做哪些操作
    const fillStaff = !onlyMissingStaff.value || !game.hasStaff
    const fillCompany = !onlyMissingCompany.value || !game.hasCompany
    const fillTags = !onlyMissingTags.value || !game.hasVndbTags

    try {
      const result = await authFetch('/api/admin/fill-info', {
        method: 'POST',
        body: { gameId: game.id, fillStaff, fillCompany, fillTags },
      }) as any

      totalStaff.value += result.staffAdded || 0
      totalCompanies.value += result.companiesMatched || 0
      totalTags.value += result.tagsSynced || 0
      totalApplied.value += result.tagsApplied || 0
      totalPending.value += result.tagsPending || 0

      const detail = (result.log || []).join('，')
      addLog(idx, label, detail || '完成', 'success')
    } catch (e: any) {
      totalFailed.value++
      const msg = e.data?.message || e.message || '未知错误'
      addLog(idx, label, `失败：${msg}`, 'error')
    }

    progress.value = idx
    await new Promise(r => setTimeout(r, 200))
  }

  running.value = false
  done.value = true
  toast.success(`补全完成：原始标签 ${totalTags.value}，中文标签 ${totalApplied.value}，待映射 ${totalPending.value}，失败 ${totalFailed.value}`)
}

function reset() {
  done.value = false
  progress.value = 0
  totalStaff.value = 0
  totalCompanies.value = 0
  totalTags.value = 0
  totalApplied.value = 0
  totalPending.value = 0
  totalSkipped.value = 0
  totalFailed.value = 0
  logs.value = []
  loadGames()
}

await Promise.all([loadGames(), loadMissingCompanyGames()])

useHead({ title: '批量补全信息 - 管理后台' })
</script>

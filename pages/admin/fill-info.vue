<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">批量补全信息</h1>

    <!-- 说明 + 操作栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6 space-y-5">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        对站内所有已关联 VNDB ID 的游戏，通过 VNDB API 补全制作人员和会社信息。无 VNDB ID 的游戏自动忽略。
      </p>

      <!-- 勾选项 -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" v-model="onlyMissingStaff" :disabled="running" class="rounded" />
          <span>仅处理<strong>没有制作人员</strong> 的游戏（已有制作人员的跳过）</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input type="checkbox" v-model="onlyMissingCompany" :disabled="running" class="rounded" />
          <span>仅处理<strong>没有会社</strong> 的游戏（已有会社关联的跳过）</span>
        </label>
      </div>

      <!-- 待处理数量提示 -->
      <div v-if="!running && !done" class="flex items-center gap-4 flex-wrap">
        <div v-if="loading" class="text-sm text-gray-400">
          <i class="fa-solid fa-spinner fa-spin mr-1"></i>加载中...
        </div>
        <template v-else>
          <div class="text-sm text-gray-500">
            共 <strong>{{ gameList.length }}</strong> 条有 VNDB ID，符合条件：<strong>{{ filteredGames.length }}</strong> 条
          </div>
          <div v-if="filteredGames.length === 0 && gameList.length > 0" class="text-sm text-yellow-600 dark:text-yellow-400">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i>当前筛选条件下无可处理的游戏
          </div>
        </template>
        <button
          @click="startFill"
          :disabled="running || filteredGames.length === 0"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm"
        >
          <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>开始补全
        </button>
      </div>

      <!-- 进度条 -->
      <div v-if="running || done">
        <div class="flex items-center justify-between text-sm mb-2">
          <span>
            {{ done ? '已完成' : '处理中...' }}
            <strong>{{ progress }}</strong> / {{ filteredGames.length }}
          </span>
          <span class="text-gray-400 text-xs">
            制作人员 +{{ totalStaff }} &nbsp;|&nbsp; 会社匹配 {{ totalCompanies }} &nbsp;|&nbsp; 跳过 {{ totalSkipped }} &nbsp;|&nbsp; 失败 {{ totalFailed }}
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
          <button
            @click="reset"
            class="px-4 py-2 bg-gray-200 dark:bg-zinc-600 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-500 transition text-sm"
          >
            重置
          </button>
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
}

interface LogEntry {
  index: number
  label: string
  message: string
  type: 'info' | 'success' | 'error'
}

const loading = ref(false)
const running = ref(false)
const done = ref(false)
const gameList = ref<Game[]>([])
const onlyMissingStaff = ref(false)
const onlyMissingCompany = ref(false)
const progress = ref(0)
const totalStaff = ref(0)
const totalCompanies = ref(0)
const totalSkipped = ref(0)
const totalFailed = ref(0)
const logs = ref<LogEntry[]>([])
const logContainerRef = ref<HTMLElement>()

// 根据勾选过滤出实际要处理的游戏
const filteredGames = computed(() => {
  return gameList.value.filter(g => {
    if (onlyMissingStaff.value && g.hasStaff) return false
    if (onlyMissingCompany.value && g.hasCompany) return false
    return true
  })
})

function gameLabel(g: Game) {
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

function addLog(index: number, label: string, message: string, type: LogEntry['type'] = 'info') {
  logs.value.push({ index, label, message, type })
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

async function startFill() {
  running.value = true
  done.value = false
  progress.value = 0
  totalStaff.value = 0
  totalCompanies.value = 0
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

    try {
      const result = await authFetch('/api/admin/fill-info', {
        method: 'POST',
        body: { gameId: game.id, fillStaff, fillCompany },
      }) as any

      totalStaff.value += result.staffAdded || 0
      totalCompanies.value += result.companiesMatched || 0

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
  toast.success(`补全完成：制作人员 +${totalStaff.value}，会社匹配 ${totalCompanies.value}，失败 ${totalFailed.value}`)
}

function reset() {
  done.value = false
  progress.value = 0
  totalStaff.value = 0
  totalCompanies.value = 0
  totalSkipped.value = 0
  totalFailed.value = 0
  logs.value = []
  loadGames()
}

await loadGames()

useHead({ title: '批量补全信息 - 管理后台' })
</script>

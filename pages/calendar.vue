<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <!-- 顶部导航 -->
    <div class="flex items-center justify-center gap-4 mb-6">
      <button
        class="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 shadow hover:shadow-lg transition"
        @click="prevMonth"
      >
        <i class="fa-solid fa-chevron-left text-gray-600 dark:text-gray-300"></i>
      </button>
      <h1 class="text-2xl font-bold min-w-[160px] text-center">{{ year }}年{{ month }}月</h1>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 shadow hover:shadow-lg transition"
        @click="nextMonth"
      >
        <i class="fa-solid fa-chevron-right text-gray-600 dark:text-gray-300"></i>
      </button>
    </div>

    <!-- 星期标题 -->
    <div class="grid grid-cols-7 mb-1">
      <div
        v-for="day in ['日', '一', '二', '三', '四', '五', '六']"
        :key="day"
        class="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2"
      >
        {{ day }}
      </div>
    </div>

    <!-- 日历网格 -->
    <div :key="`${year}-${month}`" class="cal-grid grid grid-cols-7 border-t border-l border-gray-200 dark:border-zinc-700">

      <!-- 单 div 格子，内部用 CSS 控制桌面端/手机端内容显隐，避免水合失配 -->
      <div
        v-for="(cell, idx) in calendarCells"
        :key="idx"
        class="border-r border-b border-gray-200 dark:border-zinc-700"
        :class="cell.day ? 'bg-white dark:bg-zinc-800' : 'bg-gray-50 dark:bg-zinc-900'"
        @click="cell.day && cell.games?.length ? scrollToDay(cell.day) : undefined"
      >
        <!-- 桌面端内容：封面 + 标题 -->
        <div class="hidden md:block min-h-[100px] p-1">
          <div v-if="cell.day" class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ cell.day }}</div>
          <div v-if="cell.games?.length" class="space-y-1">
            <NuxtLink
              v-for="game in cell.games.slice(0, 3)"
              :key="game.id"
              :to="`/games/${game.id}`"
              class="flex items-center gap-1 group"
            >
              <img
                v-if="game.coverImage"
                :src="game.coverImage"
                :alt="game.title"
                class="w-6 h-8 rounded-sm object-cover flex-shrink-0"
                loading="lazy"
              />
              <div v-else class="w-6 h-8 rounded-sm bg-gray-200 dark:bg-zinc-600 flex-shrink-0"></div>
              <span class="text-xs truncate group-hover:text-blue-500 transition-colors">{{ game.title }}</span>
            </NuxtLink>
            <div v-if="cell.games.length > 3" class="text-xs text-gray-400 dark:text-gray-500 pl-1">
              +{{ cell.games.length - 3 }}
            </div>
          </div>
        </div>
        <!-- 手机端内容：仅日期数字 + 小圆点 -->
        <div class="md:hidden flex flex-col items-center py-1.5 cursor-pointer select-none">
          <span
            class="text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium"
            :class="cell.day === today && year === todayYear && month === todayMonth
              ? 'bg-gray-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
              : 'text-gray-600 dark:text-gray-300'"
          >{{ cell.day || '' }}</span>
          <span
            v-if="cell.games?.length"
            class="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500"
          ></span>
          <span v-else class="mt-0.5 w-1.5 h-1.5"></span>
        </div>
      </div>
    </div>

    <!-- 手机端：按日期分组的列表 -->
    <div v-if="calendarData && calendarData.games.length > 0" class="md:hidden mt-4 space-y-4">
      <div
        v-for="group in calendarData.games"
        :key="group.date"
        :id="`day-${parseInt(group.date.split('-')[2], 10)}`"
        class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden"
      >
        <div class="px-4 py-2 bg-gray-50 dark:bg-zinc-700/60 border-b border-gray-100 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {{ group.date.split('-')[2] }}日
        </div>
        <div class="divide-y divide-gray-100 dark:divide-zinc-700">
          <NuxtLink
            v-for="game in group.games"
            :key="game.id"
            :to="`/games/${game.id}`"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
          >
            <img
              v-if="game.coverImage"
              :src="game.coverImage"
              :alt="game.title"
              class="w-10 h-14 rounded object-cover flex-shrink-0"
              loading="lazy"
            />
            <div v-else class="w-10 h-14 rounded bg-gray-200 dark:bg-zinc-600 flex-shrink-0 flex items-center justify-center">
              <i class="fa-solid fa-gamepad text-gray-400 text-xs"></i>
            </div>
            <span class="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">{{ game.title }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 空月份提示 -->
    <div
      v-if="calendarData && calendarData.games.length === 0"
      class="text-center text-gray-500 dark:text-gray-400 py-16"
    >
      <i class="fa-solid fa-calendar-xmark text-4xl mb-4"></i>
      <p>本月暂无游戏发售</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarGameItem, CalendarResponse } from '~/types/api'

const route = useRoute()
const router = useRouter()

// 使用 SSR 安全的方式获取当前年月：优先从 route query 获取
// 无 query 时使用 new Date()，但这里的 year/month 仅用于 API 查询，
// 且 calendarCells 由 API 数据驱动，不会直接导致水合失配
const _now = new Date()
const year = ref(Number(route.query.year) || _now.getFullYear())
const month = ref(Number(route.query.month) || _now.getMonth() + 1)

const { data: calendarData } = await useAuthFetch<CalendarResponse>('/api/calendar', {
  key: 'calendar-data',
  query: computed(() => ({ year: year.value, month: month.value })),
})

function syncQuery() {
  router.replace({ query: { year: year.value, month: month.value } })
}

function prevMonth() {
  if (month.value === 1) {
    year.value--
    month.value = 12
  } else {
    month.value--
  }
  syncQuery()
}

function nextMonth() {
  if (month.value === 12) {
    year.value++
    month.value = 1
  } else {
    month.value++
  }
  syncQuery()
}

// Build game lookup by day number
const gamesByDay = computed(() => {
  const map = new Map<number, { id: number; title: string; coverImage: string | null; isNsfw: boolean }[]>()
  if (!calendarData.value) return map
  for (const group of calendarData.value.games) {
    const day = parseInt(group.date.split('-')[2], 10)
    map.set(day, group.games)
  }
  return map
})

// Build calendar grid cells
const calendarCells = computed(() => {
  const firstDay = new Date(year.value, month.value - 1, 1).getDay()
  const daysInMonth = new Date(year.value, month.value, 0).getDate()
  const cells: { day: number | null; games?: { id: number; title: string; coverImage: string | null; isNsfw: boolean }[] }[] = []

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null })
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, games: gamesByDay.value.get(d) })
  }

  // Trailing empty cells to fill last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null })
  }

  return cells
})

// 今日高亮（在 onMounted 中赋值，避免服务器/客户端时区差异导致水合失配）
const today = ref(0)
const todayYear = ref(0)
const todayMonth = ref(0)

onMounted(() => {
  const todayDate = new Date()
  today.value = todayDate.getDate()
  todayYear.value = todayDate.getFullYear()
  todayMonth.value = todayDate.getMonth() + 1
})

// 点击日期格子，平滑滚动到列表对应位置
function scrollToDay(day: number) {
  const el = document.getElementById(`day-${day}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const siteName = useSiteName()
useHead({
  title: computed(() => `${year.value}年${month.value}月发售日历 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${year.value}年${month.value}月 Galgame 发售日历，一览本月新作与发售日期。`
    const title = `${year.value}年${month.value}月发售日历 - ${siteName.value}`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

<style scoped>
.cal-grid {
  animation: cal-enter 0.25s ease-out;
}
@keyframes cal-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>

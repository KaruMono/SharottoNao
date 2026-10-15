<template>
  <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
    <button type="button" class="w-full text-left group" @click="showModal = true">
      <!-- 标题栏 -->
      <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
        <Icon name="fa6-solid:gauge-high" class="text-gray-400 text-sm" />
        <h3 class="font-medium text-sm">今日流量</h3>
        <span class="ml-auto text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition">
          近7天 <Icon name="fa6-solid:chevron-right" class="text-[9px]" />
        </span>
      </div>

      <!-- 数据行 -->
      <div class="px-4 pt-3 pb-1 flex items-start justify-between gap-2">
        <!-- 左侧：今日流量 + 下载次数 -->
        <div class="min-w-0">
          <div
            class="text-2xl font-semibold tabular-nums leading-none text-gray-800 dark:text-gray-100 transition-colors"
            :class="{ 'text-emerald-600 dark:text-emerald-400': justUpdated }"
          >
            {{ slotDisplay }}
          </div>
          <div class="mt-1 text-xs text-gray-400 tabular-nums">
            {{ displayCount }} 次下载
          </div>
        </div>

        <!-- 右侧：较昨日对比 -->
        <div class="flex-shrink-0 text-right">
          <div class="text-[10px] text-gray-400 mb-0.5">较昨日</div>
          <div
            v-if="yesterdayDiff !== null"
            class="flex items-center justify-end gap-0.5 text-xs font-semibold"
            :class="yesterdayDiff >= 0 ? 'text-emerald-500' : 'text-red-500'"
          >
            <Icon :name="yesterdayDiff >= 0 ? 'fa6-solid:arrow-up' : 'fa6-solid:arrow-down'" class="text-[9px]" />
            <span class="tabular-nums">{{ diffAbsText }}</span>
          </div>
          <div v-else class="text-xs text-gray-300 dark:text-zinc-600">--</div>
        </div>
      </div>

      <!-- 迷你折线图 -->
      <div class="px-3 pt-1 pb-0.5">
        <svg
          class="w-full overflow-visible"
          height="48"
          :viewBox="`0 0 ${W} ${H}`"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#9ca3af" stop-opacity="0" />
            </linearGradient>
          </defs>
          <template v-if="pts.length >= 2">
            <path :d="fillPath" :fill="`url(#${gradId})`" />
            <path :d="linePath" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </template>
          <!-- 数据点 -->
          <circle
            v-for="(pt, i) in pts"
            :key="i"
            :cx="pt.x" :cy="pt.y"
            :r="i === pts.length - 1 ? 3.5 : 2"
            :fill="i === pts.length - 1 ? '#374151' : 'white'"
            :stroke="i === pts.length - 1 ? 'none' : '#9ca3af'"
            :stroke-width="i === pts.length - 1 ? 0 : 1.5"
            :class="i === pts.length - 1 ? '' : 'dark:fill-zinc-800'"
          />
          <!-- 今日高亮脉冲圈 -->
          <circle
            v-if="pts.length"
            :cx="pts[pts.length - 1].x"
            :cy="pts[pts.length - 1].y"
            r="3.5"
            fill="none"
            stroke="#6b7280"
            stroke-width="1"
            class="animate-ping-slow"
          />
        </svg>
      </div>

      <!-- 日期标签 -->
      <div class="px-3 pb-2.5 flex justify-between">
        <span
          v-for="(label, i) in dayLabels"
          :key="i"
          class="text-[10px] tabular-nums"
          :class="i === dayLabels.length - 1 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-zinc-500'"
        >{{ label }}</span>
      </div>
    </button>

    <!-- 详细弹窗 -->
    <Modal v-model="showModal" title="近一周流量" size="lg">
      <div class="space-y-4">
        <!-- 汇总 -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-4 py-3">
            <p class="text-[11px] text-gray-400 mb-1">一周总流量</p>
            <p class="text-lg font-semibold tabular-nums">{{ formatMb(traffic?.weekMb || 0) }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-4 py-3">
            <p class="text-[11px] text-gray-400 mb-1">一周总下载</p>
            <p class="text-lg font-semibold tabular-nums">{{ traffic?.weekCount || 0 }} 次</p>
          </div>
        </div>

        <!-- 大折线图 -->
        <div>
          <svg class="w-full overflow-visible" height="120" :viewBox="`0 0 ${MW} ${MH}`" preserveAspectRatio="none">
            <defs>
              <linearGradient :id="`${gradId}-m`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#9ca3af" stop-opacity="0.3" />
                <stop offset="100%" stop-color="#9ca3af" stop-opacity="0" />
              </linearGradient>
            </defs>
            <!-- 横向辅助线 -->
            <line
              v-for="n in 3"
              :key="n"
              x1="0" :y1="modalGridY(n)" :x2="MW" :y2="modalGridY(n)"
              stroke="currentColor" stroke-width="0.5"
              class="text-gray-100 dark:text-zinc-700"
            />
            <template v-if="mpts.length >= 2">
              <path :d="modalFillPath" :fill="`url(#${gradId}-m)`" />
              <path :d="modalLinePath" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <circle
              v-for="(pt, i) in mpts"
              :key="i"
              :cx="pt.x" :cy="pt.y"
              :r="i === mpts.length - 1 ? 4 : 2.5"
              :fill="i === mpts.length - 1 ? '#374151' : 'white'"
              :stroke="i === mpts.length - 1 ? 'none' : '#9ca3af'"
              :stroke-width="i === mpts.length - 1 ? 0 : 1.5"
              :class="i === mpts.length - 1 ? '' : 'dark:fill-zinc-800'"
            />
          </svg>
          <!-- 日期轴 -->
          <div class="flex justify-between px-0.5 mt-1">
            <span
              v-for="(label, i) in dayLabels"
              :key="i"
              class="text-[11px] tabular-nums"
              :class="i === dayLabels.length - 1 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400'"
            >{{ label }}</span>
          </div>
        </div>

        <!-- 日明细 -->
        <ul class="space-y-1.5">
          <li
            v-for="(day, i) in (traffic?.week || [])"
            :key="day.date"
            class="flex items-center gap-3 text-sm"
          >
            <span
              class="w-10 flex-shrink-0 text-xs tabular-nums"
              :class="i === (traffic?.week?.length ?? 0) - 1 ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ detailLabel(day.date, i) }}
            </span>
            <div class="flex-1 h-3 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
              <div
                class="h-full rounded-full bg-gray-400 dark:bg-zinc-400 transition-all duration-500"
                :style="{ width: barPct(day.sizeMb) }"
              ></div>
            </div>
            <span class="w-20 flex-shrink-0 text-right text-xs tabular-nums text-gray-600 dark:text-gray-300">
              {{ formatMb(day.sizeMb) }}
            </span>
            <span class="w-10 flex-shrink-0 text-right text-[11px] tabular-nums text-gray-400">
              {{ day.count }}次
            </span>
          </li>
        </ul>

        <p class="text-[11px] text-gray-400">按资源标注的文件大小累计统计</p>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { TrafficStatsItem } from '~/types/api'

const props = defineProps<{
  traffic?: TrafficStatsItem | null
}>()

// ─── 唯一 ID（SSR 安全） ──────────────────────────────────────────────
const _uid = useId()
const gradId = `tg-${_uid}`

// ─── 弹窗 ────────────────────────────────────────────────────────────
const showModal = ref(false)

// ─── 格式化工具 ──────────────────────────────────────────────────────
function formatMb(mb: number): string {
  if (!mb || mb <= 0) return '0 MB'
  if (mb < 1024) return `${Math.round(mb)} MB`
  const gb = mb / 1024
  if (gb < 1024) return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`
  return `${(gb / 1024).toFixed(2)} TB`
}

// ─── 昨日对比 ────────────────────────────────────────────────────────
const todayMb = computed(() => props.traffic?.todayMb ?? 0)
const yesterdayMb = computed(() => {
  const w = props.traffic?.week
  if (!w || w.length < 2) return null
  return w[w.length - 2].sizeMb
})
const yesterdayDiff = computed(() => {
  if (yesterdayMb.value === null) return null
  return todayMb.value - yesterdayMb.value
})
const diffAbsText = computed(() => {
  if (yesterdayDiff.value === null || yesterdayMb.value === null) return '--'
  const abs = formatMb(Math.abs(yesterdayDiff.value))
  if (yesterdayMb.value === 0) return abs
  const pct = Math.round((Math.abs(yesterdayDiff.value) / yesterdayMb.value) * 100)
  return `${abs} (${pct}%)`
})

// ─── 日期标签 ────────────────────────────────────────────────────────
const dayLabels = computed(() => {
  const w = props.traffic?.week ?? []
  return w.map((d, i) => {
    if (i === w.length - 1) return '今'
    if (i === w.length - 2) return '昨'
    const dt = new Date(d.date)
    return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`
  })
})

function detailLabel(dateStr: string, i: number): string {
  const w = props.traffic?.week ?? []
  const last = w.length - 1
  if (i === last) return '今天'
  if (i === last - 1) return '昨天'
  const d = new Date(dateStr)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

// ─── SVG 折线图（迷你版） ────────────────────────────────────────────
const W = 240
const H = 48
const PAD_X = 6
const PAD_Y = 6

const pts = computed(() => toSvgPoints(props.traffic?.week ?? [], W, H, PAD_X, PAD_Y))
const linePath = computed(() => pts.value.length >= 2 ? smoothPath(pts.value) : '')
const fillPath = computed(() => {
  if (pts.value.length < 2) return ''
  const last = pts.value[pts.value.length - 1]
  const first = pts.value[0]
  return `${smoothPath(pts.value)} L ${last.x} ${H} L ${first.x} ${H} Z`
})

// ─── SVG 折线图（弹窗大图） ──────────────────────────────────────────
const MW = 440
const MH = 120

const mpts = computed(() => toSvgPoints(props.traffic?.week ?? [], MW, MH, 10, 10))
const modalLinePath = computed(() => mpts.value.length >= 2 ? smoothPath(mpts.value) : '')
const modalFillPath = computed(() => {
  if (mpts.value.length < 2) return ''
  const last = mpts.value[mpts.value.length - 1]
  const first = mpts.value[0]
  return `${smoothPath(mpts.value)} L ${last.x} ${MH} L ${first.x} ${MH} Z`
})

function modalGridY(n: number): number {
  return Math.round((MH / 4) * n)
}

const maxWeekMb = computed(() => Math.max(...(props.traffic?.week ?? []).map(d => d.sizeMb), 1))
function barPct(mb: number): string {
  return `${Math.max(2, (mb / maxWeekMb.value) * 100)}%`
}

// ─── SVG 工具函数 ────────────────────────────────────────────────────
function toSvgPoints(
  week: Array<{ sizeMb: number }>,
  w: number, h: number,
  px: number, py: number,
): Array<{ x: number; y: number }> {
  if (!week.length) return []
  if (week.length === 1) {
    return [{ x: w / 2, y: h - py - ((week[0].sizeMb / Math.max(week[0].sizeMb, 1)) * (h - py * 2)) }]
  }
  const maxV = Math.max(...week.map(d => d.sizeMb), 1)
  return week.map((d, i) => ({
    x: px + (i / (week.length - 1)) * (w - px * 2),
    y: h - py - ((d.sizeMb / maxV) * (h - py * 2)),
  }))
}

/** Catmull-Rom 转 cubic bezier，生成自然平滑曲线 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  const d: string[] = [`M ${r(points[0].x)} ${r(points[0].y)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const t = 0.25
    const cp1x = p1.x + (p2.x - p0.x) * t
    const cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t
    const cp2y = p2.y - (p3.y - p1.y) * t
    d.push(`C ${r(cp1x)} ${r(cp1y)} ${r(cp2x)} ${r(cp2y)} ${r(p2.x)} ${r(p2.y)}`)
  }
  return d.join(' ')
}

function r(n: number): string { return n.toFixed(2) }

// ─── 动画状态 ─────────────────────────────────────────────────────────
const slotDisplay = ref('-- MB')
const displayCount = ref(0)
const justUpdated = ref(false)

let slotRafHandle = 0
let countRafHandle = 0
let justUpdatedTimer = 0
let slotGen = 0
let countGen = 0
const prevMb = ref(0)

onUnmounted(() => {
  cancelAnimationFrame(slotRafHandle)
  cancelAnimationFrame(countRafHandle)
  clearTimeout(justUpdatedTimer)
  slotGen++
  countGen++
})

// ─── 老虎机滚动动画（rAF 版） ─────────────────────────────────────────
function slotMachine(target: number, setter: (v: number) => void) {
  const totalMs = 1500
  const ceiling = Math.max(target * 1.8, 100)
  const startTime = performance.now()
  const gen = ++slotGen

  const tick = (now: number) => {
    if (gen !== slotGen) return
    const progress = (now - startTime) / totalMs
    if (progress >= 1) { setter(target); return }
    if (progress < 0.6) {
      setter(Math.floor(Math.random() * ceiling))
    } else {
      const p = (progress - 0.6) / 0.4
      const eased = 1 - Math.pow(1 - p, 2)
      const noise = Math.random() * (1 - p) * target * 0.4
      setter(Math.floor(target * eased + noise))
    }
    slotRafHandle = requestAnimationFrame(tick)
  }
  slotRafHandle = requestAnimationFrame(tick)
}

// ─── 平滑计数动画（rAF 版） ───────────────────────────────────────────
function countUp(from: number, to: number, setter: (v: number) => void, ms = 600) {
  const startTime = performance.now()
  const gen = ++countGen

  const tick = (now: number) => {
    if (gen !== countGen) return
    const p = Math.min((now - startTime) / ms, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    setter(Math.round(from + (to - from) * eased))
    if (p < 1) { countRafHandle = requestAnimationFrame(tick) }
  }
  countRafHandle = requestAnimationFrame(tick)
}

function runSlotDisplay() {
  slotMachine(todayMb.value, v => {
    slotDisplay.value = formatMb(v)
    prevMb.value = v
  })
  countUp(0, props.traffic?.todayCount ?? 0, v => {
    displayCount.value = v
  })
}

onMounted(() => { runSlotDisplay() })

watch(() => props.traffic?.todayCount, (newVal, oldVal) => {
  if (newVal === undefined || oldVal === undefined || newVal <= oldVal) return
  const fromMb = prevMb.value
  countUp(oldVal, newVal, v => { displayCount.value = v })
  countUp(fromMb, todayMb.value, v => {
    slotDisplay.value = formatMb(v)
    prevMb.value = v
  })
  justUpdated.value = true
  clearTimeout(justUpdatedTimer)
  justUpdatedTimer = window.setTimeout(() => { justUpdated.value = false }, 1500)
})
</script>

<style scoped>
/* 今日数据点脉冲
   transform-box: fill-box 确保 transform-origin 相对于圆自身而非 SVG 视口 */
@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.4; }
  70%  { transform: scale(2.6); opacity: 0; }
  100% { transform: scale(2.6); opacity: 0; }
}
.animate-ping-slow {
  transform-box: fill-box;
  transform-origin: center;
  animation: ping-slow 2.4s ease-out infinite;
}
</style>


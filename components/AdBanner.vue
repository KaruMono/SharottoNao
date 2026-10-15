<template>
  <div v-if="visibleAds.length && !dismissedToday" class="w-full min-w-0 max-w-full relative"
    @mouseenter="adHovered = true"
    @mouseleave="adHovered = false"
  >
    <template v-if="isHeaderStrip">
      <div class="header-strip-ad-wrap mx-auto w-full max-w-7xl px-4 md:px-6">
        <div class="header-strip-ad-bar">
          <div
            v-for="ad in visibleAds"
            :key="ad.id"
            class="relative header-strip-ad-item"
            @mouseenter="showStripPreview(ad, $event)"
            @mouseleave="scheduleHideStripPreview"
            @focusin="showStripPreview(ad, $event)"
            @focusout="scheduleHideStripPreview"
          >
            <a
              :href="ad.linkUrl"
              :target="ad.openInNewTab ? '_blank' : '_self'"
              rel="noopener noreferrer sponsored"
              class="header-strip-ad-link"
            >
              <span class="header-strip-ad-icon">AD</span>
              <span class="truncate">{{ ad.name || '广告' }}</span>
            </a>
          </div>
        </div>
      </div>
      <Teleport to="body">
        <Transition name="ad-slide">
          <div
            v-if="activeStripAdItem && isDesktop"
            class="fixed z-[90] hover-ad-bubble"
            :style="stripPreviewStyle"
            @mouseenter="cancelHideStripPreview"
            @mouseleave="hideStripPreview"
          >
            <div class="hover-ad-arrow"></div>
            <div class="rounded-xl bg-white dark:bg-zinc-800 shadow-xl border border-gray-200 dark:border-zinc-700 p-2">
              <a
                :href="activeStripAdItem.linkUrl"
                :target="activeStripAdItem.openInNewTab ? '_blank' : '_self'"
                rel="noopener noreferrer sponsored"
                class="block rounded-lg overflow-hidden"
              >
                <img
                  :src="activeStripAdItem.imageUrl"
                  :alt="activeStripAdItem.name || '广告'"
                  class="block w-full max-h-56 object-contain"
                  loading="lazy"
                />
              </a>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>

    <template v-else>
      <!-- 轮播容器 -->
      <div
        class="relative group/ad overflow-hidden rounded-lg"
        :class="imageClass"
      >
        <!-- 滑动轨道 -->
        <div
          class="flex h-full transition-transform duration-500 ease-in-out"
          :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
        >
          <a
            v-for="ad in visibleAds"
            :key="ad.id"
            :href="ad.linkUrl"
            :target="ad.openInNewTab ? '_blank' : '_self'"
            rel="noopener noreferrer sponsored"
            class="flex-shrink-0 min-w-0 w-full h-full block"
          >
            <img
              :src="ad.imageUrl"
              alt="广告"
              class="block w-full h-full object-cover"
              loading="lazy"
            />
          </a>
        </div>

        <!-- 左右切换按钮（多张时显示） -->
        <template v-if="visibleAds.length > 1">
          <button
            @click.prevent="prev"
            class="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover/ad:opacity-100"
            aria-label="上一张"
          >
            <Icon name="fa6-solid:chevron-left" class="text-xs" />
          </button>
          <button
            @click.prevent="next"
            class="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover/ad:opacity-100"
            aria-label="下一张"
          >
            <Icon name="fa6-solid:chevron-right" class="text-xs" />
          </button>

          <!-- 小点指示器 -->
          <div class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            <button
              v-for="(_, i) in visibleAds"
              :key="i"
              @click.prevent="goTo(i)"
              class="h-[3px] rounded-full transition-all duration-300"
              :class="i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'"
              :aria-label="`第${i + 1}张`"
            ></button>
          </div>
        </template>

      </div>

      <!-- 右上角广告标识（在 overflow-hidden 容器外，避免悬浮面板被裁剪） -->
      <div class="absolute top-1.5 right-1.5 z-20" ref="adInfoRef">
        <div class="relative">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors select-none"
            @click.stop="showInfo = !showInfo"
          >
            <Icon name="fa6-solid:rectangle-ad" class="text-white/80 text-[10px] flex-shrink-0" />
            <span class="inline-flex text-white/80 text-[9px] font-medium leading-none">
              <span
                class="badge-text-item"
                :style="{ maxWidth: adHovered ? '0' : '2.3em', opacity: adHovered ? 0 : 1 }"
              >广告</span>
              <span
                class="badge-text-item"
                :style="{ maxWidth: adHovered ? '5.3em' : '0', opacity: adHovered ? 1 : 0 }"
              >了解本广告</span>
            </span>
          </div>

          <!-- 说明面板（点击触发） -->
          <Transition name="ad-slide">
            <div
              v-if="showInfo"
              class="absolute top-full mt-1.5 right-0 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border dark:border-zinc-700 overflow-hidden z-50"
              @click.stop
            >
              <div class="px-4 py-3 border-b dark:border-zinc-700 flex items-center gap-2">
                <Icon name="fa6-solid:circle-info" class="text-gray-400 text-xs" />
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">关于本广告</span>
              </div>
              <div class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                本站为爱好者社区，维持服务器运营需要一定成本。页面中展示的广告是我们保障服务稳定、持续为您提供内容的方式之一。我们尽量保持克制，不影响您的浏览体验，感谢您的理解与包容！~
              </div>
              <div class="px-4 pb-3">
                <button
                  @click.stop="dismissForToday"
                  class="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-xs text-gray-600 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="fa6-solid:eye-slash" class="text-[10px]" />
                  关闭全部广告（今日）
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside, useEventListener, useMediaQuery } from '@vueuse/core'

interface Ad {
  id: number
  slot: string
  name?: string
  imageUrl: string
  linkUrl: string
  openInNewTab: boolean
  showOnMobile?: boolean
}

const props = defineProps<{
  adSlot: string
}>()

const isDesktop = useMediaQuery('(min-width: 768px)')
const runtimeConfig = useRuntimeConfig()
const buildId = runtimeConfig.public?.buildId as string | undefined
const { data: ads } = await useAsyncData(
  `ads-${props.adSlot}-${buildId || 'local'}`,
  () => $fetch('/api/ads', { query: { slot: props.adSlot, v: buildId } } as any) as Promise<any>,
  { default: () => [], server: false }
)

const visibleAds = computed(() => ((ads.value ?? []) as Ad[]).filter(ad => isDesktop.value || ad.showOnMobile !== false))

const isHeaderStrip = computed(() => props.adSlot === 'home_header_strip')
const isBanner = computed(() =>
  !isHeaderStrip.value && (props.adSlot.endsWith('_top') || props.adSlot.endsWith('_bottom'))
)

const imageClass = computed(() =>
  isBanner.value ? 'aspect-[6/1] md:aspect-[8/1]' : 'aspect-[4/3]'
)

// 轮播状态
const currentIndex = ref(0)
let autoplayTimer: ReturnType<typeof setInterval> | null = null

function prev() {
  if (!visibleAds.value.length) return
  currentIndex.value = (currentIndex.value - 1 + visibleAds.value.length) % visibleAds.value.length
  resetTimer()
}

function next() {
  if (!visibleAds.value.length) return
  currentIndex.value = (currentIndex.value + 1) % visibleAds.value.length
  resetTimer()
}

function goTo(i: number) {
  currentIndex.value = i
  resetTimer()
}

function startTimer() {
  if (autoplayTimer || visibleAds.value.length <= 1 || dismissedToday.value) return
  autoplayTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % visibleAds.value.length
  }, 5000)
}

function resetTimer() {
  if (autoplayTimer) { clearInterval(autoplayTimer); autoplayTimer = null }
  startTimer()
}

onUnmounted(() => {
  if (autoplayTimer) clearInterval(autoplayTimer)
})

const STORAGE_KEY = 'ads_dismissed_date'
// 跨组件实例共享，保证点击一处后全页所有广告同步关闭
const dismissedToday = useState('adsDismissedToday', () => false)
const adHovered = ref(false)
const showInfo = ref(false)
const activeStripAd = ref<number | null>(null)
const activeStripAdItem = computed(() => visibleAds.value.find(ad => ad.id === activeStripAd.value))
const stripPreviewStyle = ref<Record<string, string>>({})
let stripPreviewTimer: ReturnType<typeof setTimeout> | null = null
const adInfoRef = ref<HTMLElement | null>(null)

function cancelHideStripPreview() {
  if (stripPreviewTimer) clearTimeout(stripPreviewTimer)
  stripPreviewTimer = null
}

function hideStripPreview() {
  cancelHideStripPreview()
  activeStripAd.value = null
}

function scheduleHideStripPreview() {
  cancelHideStripPreview()
  stripPreviewTimer = setTimeout(hideStripPreview, 120)
}

function showStripPreview(ad: Ad, event: MouseEvent | FocusEvent) {
  if (!import.meta.client || !isDesktop.value) return
  cancelHideStripPreview()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const width = Math.min(298, window.innerWidth - 24)
  const center = Math.min(Math.max(rect.left + rect.width / 2, 12 + width / 2), window.innerWidth - 12 - width / 2)
  stripPreviewStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${center}px`,
    width: `${width}px`,
    transform: 'translateX(-50%)',
  }
  activeStripAd.value = ad.id
}

useEventListener('resize', hideStripPreview)
useEventListener('scroll', hideStripPreview, { capture: true, passive: true })
onUnmounted(cancelHideStripPreview)

// 切换设备宽度或重新加载广告后重置轮播，避免索引落在已隐藏的广告上。
watch([visibleAds, dismissedToday], () => {
  currentIndex.value = 0
  hideStripPreview()
  showInfo.value = false
  if (import.meta.client) resetTimer()
})

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === getTodayStr()) {
    dismissedToday.value = true
  }
  startTimer()
})

function dismissForToday() {
  localStorage.setItem(STORAGE_KEY, getTodayStr())
  dismissedToday.value = true
  showInfo.value = false
}

onClickOutside(adInfoRef, () => { showInfo.value = false })
</script>

<style scoped>
.ad-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.ad-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ad-slide-enter-from {
  opacity: 0;
  transform: var(--ad-slide-transform, none) translateY(-16px);
}
.ad-slide-leave-to {
  opacity: 0;
  transform: var(--ad-slide-transform, none) translateY(-8px);
}
.badge-text-item {
  overflow: hidden;
  white-space: nowrap;
  transition: max-width 0.28s ease, opacity 0.22s ease;
}

.header-strip-ad-wrap {
  position: relative;
  z-index: 20;
}

.header-strip-ad-bar {
  min-height: 40px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(0.5rem, 2vw, 1rem);
  padding: 6px;
  overflow: visible;
  border: 1px solid rgb(229, 231, 235);
  border-radius: 0.875rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
  backdrop-filter: blur(12px);
}

.dark .header-strip-ad-bar {
  border-color: rgb(63, 63, 70);
  background: rgba(39, 39, 42, 0.86);
}

.header-strip-ad-item {
  min-width: 0;
  flex: 0 1 auto;
}

.header-strip-ad-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  max-width: 11rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.65rem;
  color: rgb(75, 85, 99);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dark .header-strip-ad-link {
  color: rgb(212, 212, 216);
}

.header-strip-ad-link:hover {
  color: rgb(17, 24, 39);
  background: rgb(243, 244, 246);
}

.dark .header-strip-ad-link:hover {
  color: white;
  background: rgb(63, 63, 70);
}

.header-strip-ad-icon {
  height: 1rem;
  min-width: 1.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 0.25rem;
  border: 1px solid rgb(209, 213, 219);
  color: rgb(107, 114, 128);
  background: rgb(249, 250, 251);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
}

.dark .header-strip-ad-icon {
  border-color: rgb(82, 82, 91);
  color: rgb(161, 161, 170);
  background: rgb(39, 39, 42);
}

.hover-ad-bubble {
  transform-origin: top center;
  --ad-slide-transform: translateX(-50%);
}

.hover-ad-arrow {
  width: 0.75rem;
  height: 0.75rem;
  margin: 0 auto -0.375rem;
  transform: rotate(45deg);
  background: white;
  border-left: 1px solid rgba(229, 231, 235, 0.8);
  border-top: 1px solid rgba(229, 231, 235, 0.8);
}

.dark .hover-ad-arrow {
  background: rgb(39, 39, 42);
  border-color: rgb(63, 63, 70);
}

@media (max-width: 767px) {
  .header-strip-ad-bar {
    justify-content: flex-start;
    gap: 0.25rem;
  }

  .header-strip-ad-link {
    max-width: 8.5rem;
    font-size: 0.8125rem;
  }
}
</style>

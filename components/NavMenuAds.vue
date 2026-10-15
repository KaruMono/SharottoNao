<template>
  <div
    v-if="ads.length"
    :class="['nav-menu-ad-list', props.mobile && 'nav-menu-ad-list--mobile']"
  >
    <div
      v-for="ad in ads"
      :key="ad.id"
      class="relative nav-menu-ad-item"
      @mouseenter="showAdPreview(ad, $event)"
      @mouseleave="scheduleHidePreview"
    >
      <a
        :href="ad.linkUrl"
        :target="ad.openInNewTab ? '_blank' : '_self'"
        rel="noopener noreferrer sponsored"
        :class="props.mobile ? 'mobile-nav-ad-link' : 'nav-menu-ad-link'"
      >
        <template v-if="props.mobile">
          <FaIcon :icon="ad.icon || 'fa6-solid:rectangle-ad'" class="w-5 text-center text-gray-400" />
          <span class="min-w-0 flex-1 truncate">{{ ad.name || '广告' }}</span>
        </template>
        <template v-else>
          <span class="truncate">{{ ad.name || '广告' }}</span>
        </template>
      </a>
    </div>

    <ClientOnly>
      <Teleport to="body">
        <Transition name="ad-slide">
          <div
            v-if="activeAdItem && !props.mobile"
            class="fixed z-[90] nav-menu-ad-bubble"
            :style="previewStyle"
            @mouseenter="cancelHidePreview"
            @mouseleave="hidePreview"
          >
            <div class="nav-menu-ad-arrow"></div>
            <div class="rounded-xl bg-white dark:bg-zinc-800 shadow-xl border border-gray-200 dark:border-zinc-700 p-2">
              <a
                :href="activeAdItem.linkUrl"
                :target="activeAdItem.openInNewTab ? '_blank' : '_self'"
                rel="noopener noreferrer sponsored"
                class="block rounded-lg overflow-hidden"
              >
                <img
                  :src="activeAdItem.imageUrl"
                  :alt="activeAdItem.name || '广告'"
                  class="block w-full max-h-56 object-contain"
                  loading="lazy"
                />
              </a>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

interface Ad {
  id: number
  name?: string
  icon?: string | null
  imageUrl: string
  linkUrl: string
  openInNewTab: boolean
  showOnMobile?: boolean
}

const props = withDefaults(defineProps<{
  mobile?: boolean
  ads?: Ad[]
}>(), {
  mobile: false,
  ads: () => [],
})

const activeAd = ref<number | null>(null)
const ads = computed(() => props.ads.filter(ad => !props.mobile || ad.showOnMobile !== false))
const activeAdItem = computed(() => ads.value.find(ad => ad.id === activeAd.value) || null)
const previewStyle = ref<Record<string, string>>({})
let hideTimer: ReturnType<typeof setTimeout> | null = null

function cancelHidePreview() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function showAdPreview(ad: Ad, event: MouseEvent) {
  if (props.mobile || !import.meta.client) return

  cancelHidePreview()
  activeAd.value = ad.id

  const trigger = event.currentTarget as HTMLElement
  const rect = trigger.getBoundingClientRect()
  const bubbleWidth = Math.min(298, window.innerWidth - 24)
  const center = rect.left + rect.width / 2
  const left = Math.min(
    Math.max(center, 12 + bubbleWidth / 2),
    window.innerWidth - 12 - bubbleWidth / 2,
  )

  previewStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${bubbleWidth}px`,
    transform: 'translateX(-50%)',
  }
}

function hidePreview() {
  cancelHidePreview()
  activeAd.value = null
}

function scheduleHidePreview() {
  cancelHidePreview()
  hideTimer = setTimeout(() => {
    activeAd.value = null
    hideTimer = null
  }, 120)
}

onUnmounted(() => {
  cancelHidePreview()
})

useEventListener('resize', hidePreview)
useEventListener('scroll', hidePreview, { capture: true, passive: true })
</script>

<style scoped>
.nav-menu-ad-list {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 0 0 auto;
  min-width: 0;
  overflow: hidden;
}

.nav-menu-ad-item {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
}

.nav-menu-ad-link {
  display: inline-flex;
  align-items: center;
  max-width: 8rem;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: rgb(75, 85, 99);
  font-size: 0.875rem;
  transition: opacity 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-menu-ad-link:hover {
  background: transparent;
  box-shadow: none;
  opacity: 0.85;
}

.dark .nav-menu-ad-link {
  color: rgb(212, 212, 216);
}

.dark .nav-menu-ad-link:hover {
  background: transparent;
  box-shadow: none;
  opacity: 0.85;
}

.nav-menu-ad-link > .truncate {
  background-image: linear-gradient(90deg, rgb(59, 130, 246) 0%, rgb(168, 85, 247) 20%, rgb(236, 72, 153) 50%, rgb(168, 85, 247) 80%, rgb(59, 130, 246) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow-shift 3s linear infinite;
  font-weight: 500;
}

@keyframes rainbow-shift {
  0% { background-position-x: 0%; }
  100% { background-position-x: 200%; }
}

.nav-menu-ad-bubble {
  transform-origin: top center;
  --ad-slide-transform: translateX(-50%);
  max-width: min(298px, calc(100vw - 24px));
}

.nav-menu-ad-arrow {
  width: 0.75rem;
  height: 0.75rem;
  margin: 0 auto -0.375rem;
  transform: rotate(45deg);
  background: white;
  border-left: 1px solid rgba(229, 231, 235, 0.8);
  border-top: 1px solid rgba(229, 231, 235, 0.8);
}

.dark .nav-menu-ad-arrow {
  background: rgb(39, 39, 42);
  border-color: rgb(63, 63, 70);
}

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

.mobile-menu-ad-list .nav-menu-ad-item {
  width: 100%;
  display: block;
}

.mobile-menu-ad-list .nav-menu-ad-list {
  display: block;
  width: 100%;
  overflow: visible;
}

.mobile-menu-ad-list .mobile-nav-ad-link {
  display: flex;
  width: 100%;
}

.nav-menu-ad-list--mobile {
  display: block;
  width: 100%;
  overflow: visible;
}

.nav-menu-ad-list--mobile .nav-menu-ad-item {
  width: 100%;
  display: block;
}

.nav-menu-ad-list--mobile .mobile-nav-ad-link {
  display: flex;
  width: 100%;
}

.mobile-nav-ad-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: none;
  width: 100%;
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-size: 0.875rem;
  font-weight: 400;
  transition: background-color 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
}

.mobile-nav-ad-link:hover {
  background: rgb(243, 244, 246);
  box-shadow: none;
}

.dark .mobile-nav-ad-link:hover {
  background: rgb(63, 63, 70);
  box-shadow: none;
}
</style>

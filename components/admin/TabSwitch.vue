<template>
  <div
    ref="tablist"
    class="admin-tabs"
    role="tablist"
    :aria-label="label"
    :data-indicator-ready="indicatorReady ? '' : undefined"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      :ref="el => setTabRef(el as HTMLButtonElement | null, tab.value)"
      type="button"
      role="tab"
      class="admin-tab"
      :aria-selected="modelValue === tab.value"
      :aria-controls="tab.panelId"
      :disabled="tab.disabled"
      :tabindex="tab.value === focusableValue ? 0 : -1"
      @click="activate(tab.value)"
      @keydown="onKeydown($event, tab.value)"
    >
      <slot name="tab" :tab="tab">
        <Icon v-if="tab.icon" :name="tab.icon" class="admin-tab-icon" aria-hidden="true" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.badge" class="admin-tab-badge">{{ tab.badge }}</span>
      </slot>
    </button>
    <span
      v-show="indicatorReady"
      aria-hidden="true"
      class="admin-tabs-indicator"
      :data-instant="indicatorInstant ? '' : undefined"
      :style="{ transform: `translateX(${indicatorLeft}px)`, width: `${indicatorWidth}px` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '~/assets/css/admin-controls.css'

interface Tab {
  label: string
  value: string
  icon?: string
  badge?: number | string
  disabled?: boolean
  panelId?: string
}

const props = withDefaults(defineProps<{
  tabs: Tab[]
  modelValue: string
  label?: string
}>(), { label: '视图切换' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const tablist = ref<HTMLElement>()
const tabRefs = new Map<string, HTMLButtonElement>()
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)
const indicatorReady = ref(false)
const indicatorInstant = ref(true)
const enabledTabs = computed(() => props.tabs.filter(tab => !tab.disabled))
const focusableValue = computed(() => enabledTabs.value.some(tab => tab.value === props.modelValue)
  ? props.modelValue : enabledTabs.value[0]?.value)

let observer: ResizeObserver | undefined
let frame = 0
let disposed = false

function setTabRef(element: HTMLButtonElement | null, value: string) {
  const previous = tabRefs.get(value)
  if (previous === element) return
  if (previous) observer?.unobserve(previous)
  if (element) {
    tabRefs.set(value, element)
    observer?.observe(element)
  } else {
    tabRefs.delete(value)
  }
}

function updateIndicator(instant = false) {
  const tab = tabRefs.get(props.modelValue)
  if (!tab || !tab.offsetWidth) {
    indicatorReady.value = false
    return
  }
  if (instant) indicatorInstant.value = true
  indicatorLeft.value = tab.offsetLeft
  indicatorWidth.value = tab.offsetWidth
  indicatorReady.value = true
  if (instant) {
    cancelAnimationFrame(frame)
    nextTick(() => {
      if (!disposed) frame = requestAnimationFrame(() => { indicatorInstant.value = false })
    })
  }
}

function activate(value: string) {
  if (props.tabs.find(tab => tab.value === value)?.disabled) return
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent, value: string) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const tabs = enabledTabs.value
  if (!tabs.length) return
  const index = tabs.findIndex(tab => tab.value === value)
  const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1]
    : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
  if (!target) return
  activate(target.value)
  nextTick(() => {
    const tab = tabRefs.get(target.value)
    tab?.focus({ preventScroll: true })
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

function refreshGeometry() { updateIndicator(true) }

watch(() => props.modelValue, () => updateIndicator(), { flush: 'post' })
// Callers may recreate the array on each render. Only content changes require
// an instant measurement; selecting a tab should keep its 200ms transition.
watch(() => JSON.stringify(props.tabs), refreshGeometry, { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver(refreshGeometry)
  if (tablist.value) observer.observe(tablist.value)
  tabRefs.forEach(tab => observer?.observe(tab))
  refreshGeometry()
  document.fonts.ready.then(() => { if (!disposed) refreshGeometry() })
  document.fonts.addEventListener('loadingdone', refreshGeometry)
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  cancelAnimationFrame(frame)
  document.fonts.removeEventListener('loadingdone', refreshGeometry)
})
</script>

<template>
  <span ref="shell" class="admin-select" :class="$attrs.class" :style="$attrs.style">
    <!-- Keep native option values, form validation and the original change event. -->
    <select
      ref="native"
      v-bind="nativeAttrs()"
      v-model="selection"
      class="admin-select-native"
      :disabled="disabled"
      tabindex="-1"
      aria-hidden="true"
      @change="handleChange"
      @invalid.prevent="handleInvalid"
      @focus="trigger?.focus()"
    ><slot /></select>
    <span class="admin-select-measure" aria-hidden="true"><span v-for="option in options" :key="option.index">{{ option.label }}</span></span>
    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      class="admin-select-trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="label"
      :aria-labelledby="$attrs['aria-labelledby'] as string | undefined"
      :aria-describedby="$attrs['aria-describedby'] as string | undefined"
      :aria-required="$attrs.required !== undefined && $attrs.required !== false || undefined"
      :aria-invalid="invalid || $attrs['aria-invalid'] === true || $attrs['aria-invalid'] === 'true' || undefined"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined"
      :disabled="disabled"
      :title="$attrs.title as string | undefined"
      @click="open ? close() : show()"
      @keydown="onKeydown"
    >
      <span class="admin-select-value">{{ selectedLabel }}</span>
      <svg class="admin-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <Teleport :to="teleportTarget">
      <div v-if="open" ref="popup" class="admin-select-popup" :data-side="side" @mousedown.prevent>
        <div :id="listId" class="admin-select-options" role="listbox" :aria-label="label" :aria-labelledby="$attrs['aria-labelledby'] as string | undefined">
          <template v-for="(option, index) in options" :key="option.index">
            <div v-if="option.group && option.group !== options[index - 1]?.group" class="admin-select-group" role="presentation">{{ option.group }}</div>
            <div
              :id="`${listId}-${index}`"
              role="option"
              class="admin-select-option"
              :aria-selected="option.selected"
              :aria-disabled="option.disabled"
              :data-highlighted="highlighted === index ? '' : undefined"
              @pointermove="!option.disabled && highlight(index, false)"
              @click="choose(index)"
            >
              <span>{{ option.label }}</span>
              <svg class="admin-select-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
            </div>
          </template>
          <div v-if="!options.length" class="admin-select-empty" role="status">暂无选项</div>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, useAttrs, useId, watch } from 'vue'
import '~/assets/css/admin-controls.css'

// Vue adapter of references/interaction-spec.md §2 and assets/interactions.js.
// Render the listbox with Vue; the native select remains the form/value adapter.
defineOptions({ inheritAttrs: false })
type Value = string | number | boolean | null
const props = withDefaults(defineProps<{
  modelValue?: Value
  value?: Value
  modelModifiers?: { number?: boolean }
  disabled?: boolean
}>(), { modelValue: undefined, value: undefined })
const emit = defineEmits<{
  'update:modelValue': [value: Value]
  change: [event: Event]
}>()
const attrs = useAttrs()
const uid = useId()
const triggerId = computed(() => String(attrs.id || `admin-select-${uid}`))
const listId = `admin-select-list-${uid}`
const label = computed(() => String(attrs['aria-label'] || '选择选项'))
const selection = computed({
  get: () => props.modelValue !== undefined ? props.modelValue : props.value,
  set: (value) => {
    const number = props.modelModifiers?.number && typeof value === 'string' ? Number.parseFloat(value) : NaN
    emit('update:modelValue', Number.isNaN(number) ? value as Value : number)
  },
})
const shell = ref<HTMLElement>()
const native = ref<HTMLSelectElement>()
const trigger = ref<HTMLButtonElement>()
const popup = ref<HTMLElement>()
// Native modal dialogs make the rest of body inert; keep their listbox inside.
const teleportTarget = ref<string | HTMLElement>('body')
const open = ref(false)
const invalid = ref(false)
const highlighted = ref(-1)
const side = ref('bottom')
interface Option { index: number; label: string; selected: boolean; disabled: boolean; group: string }
const options = ref<Option[]>([])
const selectedLabel = computed(() => options.value.find(option => option.selected)?.label || '请选择')
let resetValue: Value | undefined
let form: HTMLFormElement | null = null
let resizeObserver: ResizeObserver | undefined
let typeahead = ''
let typeTimer: ReturnType<typeof setTimeout> | undefined

function nativeAttrs() {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => !['class', 'style', 'id', 'aria-label', 'aria-labelledby', 'aria-describedby', 'title'].includes(key)))
}

function syncOptions() {
  if (!native.value) return
  const next = Array.from(native.value.options).flatMap((option, index) => {
    if (option.hidden) return []
    const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null
    return [{ index, label: option.label, selected: option.selected, disabled: option.disabled || Boolean(group?.disabled), group: group?.label || '' }]
  })
  if (JSON.stringify(next) !== JSON.stringify(options.value)) options.value = next
  if (open.value && (!options.value[highlighted.value] || options.value[highlighted.value]?.disabled)) {
    highlighted.value = options.value.findIndex(option => !option.disabled)
  }
}

function handleChange(event: Event) {
  invalid.value = false
  syncOptions()
  emit('change', event)
}
function handleInvalid() {
  invalid.value = true
  trigger.value?.focus()
}
function highlight(index: number, scroll = true) {
  highlighted.value = index
  if (scroll) nextTick(() => document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' }))
}
function position() {
  if (!open.value || !trigger.value || !popup.value) return
  const panel = popup.value
  const rect = trigger.value.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const maxHeight = Math.max(0, Math.min(300, Math.max(below, above)))
  // The reference requires at least the trigger width, not a fixed equal width.
  // Let the actual popup text, checkmark and scrollbar determine intrinsic width.
  // Apply the constraints before measuring so wrapping at the viewport edge is
  // included in both height and placement calculations.
  panel.style.minWidth = `${Math.min(rect.width, window.innerWidth - 16)}px`
  panel.style.maxHeight = `${maxHeight}px`
  const { width, height } = panel.getBoundingClientRect()
  const bottom = below >= height || below >= above
  side.value = bottom ? 'bottom' : 'top'
  panel.style.top = `${Math.max(8, Math.min(bottom ? rect.bottom + 4 : rect.top - 4 - height, window.innerHeight - height - 8))}px`
  panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
}
async function show() {
  if (props.disabled || open.value) return
  syncOptions()
  open.value = true
  const selected = options.value.findIndex(option => option.selected && !option.disabled)
  highlighted.value = selected >= 0 ? selected : options.value.findIndex(option => !option.disabled)
  await nextTick()
  position()
  highlight(highlighted.value)
}
function close(focus = true) {
  open.value = false
  typeahead = ''
  if (typeTimer) clearTimeout(typeTimer)
  if (focus) trigger.value?.focus()
}
function choose(index: number) {
  const option = options.value[index]
  if (!native.value || !option || option.disabled || props.disabled) return
  native.value.selectedIndex = option.index
  // Vue's native v-model reads option._value, preserving numeric option values.
  native.value.dispatchEvent(new Event('input', { bubbles: true }))
  native.value.dispatchEvent(new Event('change', { bubbles: true }))
  close()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    close()
  } else if (event.key === 'Tab') {
    close(false)
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (!open.value) { show(); return }
    if (event.key === 'Enter' || event.key === ' ') { choose(highlighted.value); return }
    const enabled = options.value.flatMap((option, index) => option.disabled ? [] : [index])
    if (!enabled.length) return
    const current = enabled.indexOf(highlighted.value)
    const target = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1]
      : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]
    highlight(target!)
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    if (!open.value) show()
    if (typeTimer) clearTimeout(typeTimer)
    typeahead += event.key.toLocaleLowerCase()
    const index = options.value.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(typeahead))
    if (index >= 0) highlight(index)
    typeTimer = setTimeout(() => { typeahead = '' }, 700)
  }
}
function outside(event: Event) {
  if (open.value && !shell.value?.contains(event.target as Node) && !popup.value?.contains(event.target as Node)) close(false)
}
function reset() {
  // Native reset happens after the event. Restore the Vue value as well.
  queueMicrotask(() => {
    selection.value = resetValue
    invalid.value = false
    close(false)
    nextTick(syncOptions)
  })
}
watch(() => props.disabled, disabled => { if (disabled) close(false) })
watch(selection, () => { invalid.value = false; nextTick(syncOptions) })
onMounted(() => {
  teleportTarget.value = shell.value?.closest('dialog') || 'body'
  resetValue = selection.value
  form = native.value?.form || null
  form?.addEventListener('reset', reset)
  syncOptions()
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', outside)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  resizeObserver = new ResizeObserver(position)
  if (trigger.value) resizeObserver.observe(trigger.value)
})
onUpdated(() => {
  syncOptions()
  position()
})
onBeforeUnmount(() => {
  form?.removeEventListener('reset', reset)
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', outside)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
  resizeObserver?.disconnect()
  if (typeTimer) clearTimeout(typeTimer)
})
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    v-bind="$attrs"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : unavailable"
    :aria-disabled="to && unavailable ? true : undefined"
    :aria-busy="loading || undefined"
    :tabindex="to && unavailable ? -1 : $attrs.tabindex"
    class="admin-button"
    :class="[
      `admin-button--${variant === 'emphasis' ? 'primary' : variant}`,
      `admin-button--${size}`,
      { 'admin-button--active': active, 'admin-button--icon': icon, 'admin-button--full': fullWidth },
    ]"
    @click.capture="guardDisabled"
    @click="handleClick"
  >
    <span v-if="loading" class="admin-control-spinner" aria-hidden="true" />
    <span class="admin-button-content" :class="{ 'admin-button-content--loading': loading }"><slot /></span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink } from '#components'
import '~/assets/css/admin-controls.css'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'emphasis' | 'danger'
  size?: 'default' | 'toolbar' | 'sm'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  to?: string
  active?: boolean
  icon?: boolean
  fullWidth?: boolean
}>(), { variant: 'secondary', size: 'default', type: 'button' })

const emit = defineEmits<{ click: [event: MouseEvent] }>()
const unavailable = computed(() => props.disabled || props.loading)

function guardDisabled(event: MouseEvent) {
  if (unavailable.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
}
function handleClick(event: MouseEvent) {
  if (!unavailable.value) emit('click', event)
}
</script>

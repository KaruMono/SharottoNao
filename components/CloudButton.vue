<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : unavailable"
    :aria-disabled="to && unavailable ? true : undefined"
    :aria-busy="loading || undefined"
    :tabindex="to && unavailable ? -1 : undefined"
    class="cloud-button"
    :class="[
      `cloud-button--${variant}`,
      { 'cloud-button--large': size === 'large', 'cloud-button--full': fullWidth },
    ]"
    @click.capture="guardDisabled"
    @click="handleClick"
  >
    <span v-if="loading" class="cloud-button-spinner" aria-hidden="true" />
    <span class="cloud-button-content"><slot /></span>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'default' | 'large'
  type?: 'button' | 'submit' | 'reset'
  to?: string
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
}>(), {
  variant: 'secondary',
  size: 'default',
  type: 'button',
  disabled: false,
  loading: false,
  fullWidth: false,
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()
const unavailable = computed(() => props.disabled || props.loading)

function guardDisabled(event: MouseEvent) {
  if (unavailable.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}

function handleClick(event: MouseEvent) {
  if (!unavailable.value) emit('click', event)
}
</script>

<style scoped>
/* Cloudflare reference: assets/components.css + references/interaction-spec.md.
 * Keep Charlotte's font; the 44px form variant aligns with existing inputs. */
.cloud-button {
  --button-brand: oklch(57.72% .2324 260);
  --button-base: #fff;
  --button-line: oklch(14.5% 0 0 / .1);
  --button-tint: oklch(97% 0 0);
  --button-text: oklch(20.5% 0 0);
  --button-subtle: oklch(55.6% 0 0);
  --button-danger: oklch(50.5% .213 27.518);
  --button-danger-tint: oklch(93.6% .032 17.7 / .42);
  --button-top: color-mix(in oklch, var(--button-brand), white 15%);
  --button-highlight: color-mix(in oklch, var(--button-brand), white 30%);
  --button-ring: color-mix(in oklch, var(--button-brand), black 10%);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--button-base);
  color: var(--button-text);
  box-shadow: 0 0 0 1px var(--button-line), 0 1px 2px #0000000d;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
  letter-spacing: -.01em;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: none;
}

.dark .cloud-button {
  --button-brand: oklch(51.948% .2324 260);
  --button-base: oklch(17% 0 0);
  --button-line: oklch(32% 0 0);
  --button-tint: oklch(26.9% 0 0);
  --button-text: oklch(97% 0 0);
  --button-subtle: oklch(70.8% 0 0);
  --button-danger: oklch(70.4% .191 22.216);
  --button-danger-tint: oklch(42.9% .176 28.7 / .17);
}

.cloud-button--primary {
  color: #fff;
  background: linear-gradient(var(--button-top), var(--button-brand));
  box-shadow: inset 0 1px 0 var(--button-highlight), 0 0 0 1px var(--button-ring), 0 1px 2px #0000000d;
}

.cloud-button--ghost {
  color: var(--button-subtle);
  background: transparent;
  box-shadow: none;
}

.cloud-button--danger { color: var(--button-danger); }
.cloud-button--large { height: 44px; padding-inline: 16px; }
.cloud-button--full { width: 100%; }
.cloud-button:focus-visible { outline: 2px solid var(--button-brand); outline-offset: 3px; }
.cloud-button:is(:disabled, [aria-disabled=true]) { opacity: .5; cursor: not-allowed; }
.cloud-button-content { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.cloud-button-content :deep(svg), .cloud-button-content :deep(.iconify) { flex-shrink: 0; }

.cloud-button-spinner {
  position: absolute;
  left: 12px;
  top: calc(50% - 7px);
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: cloud-button-spin .8s linear infinite;
}

@keyframes cloud-button-spin { to { transform: rotate(360deg); } }

@media (hover: hover) {
  .cloud-button:hover:not(:disabled):not([aria-disabled=true]) { background: var(--button-tint); }
  .cloud-button--primary:hover:not(:disabled):not([aria-disabled=true]) {
    background: linear-gradient(var(--button-highlight), var(--button-brand));
  }
  .cloud-button--ghost:hover:not(:disabled):not([aria-disabled=true]) { color: var(--button-text); }
  .cloud-button--danger:hover:not(:disabled):not([aria-disabled=true]) { background: var(--button-danger-tint); }
}

@media (pointer: coarse) {
  .cloud-button { min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-button-spinner { animation: none; }
}
</style>

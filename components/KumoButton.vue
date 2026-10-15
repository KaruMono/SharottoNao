<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="disabled"
    :class="buttonClasses"
    v-bind="$attrs"
  >
    <span v-if="(variant === 'emphasis' || variant === 'danger') || (variant === 'secondary' && active)" aria-hidden="true" :class="gradientClasses" />
    <span :class="contentClasses">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'emphasis' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  to?: string
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  type: 'button',
  active: false,
})

const baseClasses = 'group flex w-max shrink-0 items-center justify-center font-medium select-none border-0 focus:outline-none focus-visible:ring-2 cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-600 py-2.5 gap-1.5 rounded-lg px-4 text-sm transition-all duration-150'

const buttonClasses = computed(() => {
  const classes = [baseClasses]

  if (props.variant === 'secondary') {
    if (props.active) {
      // 激活状态：浅灰色背景 + 渐变
      classes.push(
        'relative overflow-hidden',
        'bg-gray-100 dark:bg-zinc-700',
        '!text-gray-900 dark:!text-white',
        'shadow-sm'
      )
    } else {
      // 未激活状态：白色背景
      classes.push(
        'bg-white dark:bg-zinc-800',
        '!text-gray-700 dark:!text-gray-200',
        'ring-1 ring-gray-200 dark:ring-zinc-700',
        'hover:bg-gray-50 dark:hover:bg-zinc-700/70',
        'focus-visible:ring-gray-400 dark:focus-visible:ring-zinc-600',
        'shadow-sm',
        'disabled:bg-gray-50 dark:disabled:bg-zinc-800/50',
        'disabled:!text-gray-400 dark:disabled:!text-gray-600'
      )
    }
  } else if (props.variant === 'ghost') {
    classes.push(
      'bg-transparent',
      'text-gray-700 dark:text-gray-200',
      'hover:text-gray-900 dark:hover:text-white',
      'transition-colors'
    )
  } else if (props.variant === 'emphasis') {
    classes.push(
      'relative overflow-hidden',
      'bg-blue-600 dark:bg-blue-500',
      '!text-white',
      'shadow-sm',
      'hover:bg-blue-500 dark:hover:bg-blue-400',
      'disabled:opacity-50'
    )
  } else if (props.variant === 'danger') {
    classes.push(
      'relative overflow-hidden',
      'bg-red-600 dark:bg-red-500',
      '!text-white',
      'shadow-sm',
      'hover:bg-red-500 dark:hover:bg-red-400',
      'disabled:opacity-50'
    )
  }

  return classes.join(' ')
})

const gradientClasses = computed(() => {
  if (props.variant === 'emphasis') {
    return [
      'absolute inset-0 rounded-[inherit]',
      'bg-gradient-to-b',
      'from-blue-500 dark:from-blue-400',
      'to-blue-600 dark:to-blue-500',
      'group-hover:from-blue-600 dark:group-hover:from-blue-500',
      'group-disabled:from-blue-600 dark:group-disabled:from-blue-500',
      'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
      'transition-all duration-150'
    ].join(' ')
  }
  if (props.variant === 'danger') {
    return [
      'absolute inset-0 rounded-[inherit]',
      'bg-gradient-to-b',
      'from-red-500 dark:from-red-400',
      'to-red-600 dark:to-red-500',
      'group-hover:from-red-600 dark:group-hover:from-red-500',
      'group-disabled:from-red-600 dark:group-disabled:from-red-500',
      'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]',
      'transition-all duration-150'
    ].join(' ')
  }
  if (props.variant === 'secondary' && props.active) {
    return [
      'absolute inset-0 rounded-[inherit]',
      'bg-gradient-to-b',
      'from-gray-50 dark:from-zinc-600',
      'to-gray-100 dark:to-zinc-700',
      'group-hover:from-gray-100 dark:group-hover:from-zinc-700',
      'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]',
      'transition-all duration-150'
    ].join(' ')
  }
  return ''
})

const contentClasses = computed(() => {
  if (props.variant === 'emphasis' || props.variant === 'danger' || (props.variant === 'secondary' && props.active)) {
    return 'relative flex items-center gap-1.5'
  }
  return 'flex items-center gap-1.5'
})
</script>

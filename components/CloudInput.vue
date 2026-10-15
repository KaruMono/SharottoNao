<template>
  <div class="relative">
    <label v-if="label" class="block text-sm font-medium mb-2">
      {{ label }}
    </label>
    <div
      class="relative cursor-text border-0 bg-gray-50 dark:bg-zinc-700/50 text-gray-900 dark:text-gray-100 ring-1 ring-gray-200 dark:ring-zinc-700 outline-none focus-within:ring-[1.5px] focus-within:ring-blue-500/50 dark:focus-within:ring-blue-400/50 rounded-lg transition-all duration-150 overflow-hidden"
      :class="{ 'ring-red-500 dark:ring-red-400': error }"
    >
      <!-- 前缀图标 -->
      <div v-if="$slots.prefix" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
        <slot name="prefix" />
      </div>

      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :required="required"
        class="w-full px-4 py-2.5 bg-transparent text-base border-0 outline-none focus:outline-none ring-0 focus:ring-0"
        :class="{
          'pl-10': $slots.prefix,
          'pr-10': $slots.suffix,
          'disabled:opacity-50 disabled:cursor-not-allowed': disabled
        }"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
      />

      <!-- 后缀图标 -->
      <div v-if="$slots.suffix" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
        <slot name="suffix" />
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="mt-1.5 text-sm text-red-500 dark:text-red-400">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  type?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  autocomplete?: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleBlur(event: FocusEvent) {
  emit('blur', event)
}

function handleFocus(event: FocusEvent) {
  emit('focus', event)
}
</script>

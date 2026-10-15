<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="modelValue"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      >
        <div 
          :class="[
            'bg-white dark:bg-zinc-800 rounded-xl shadow-xl modal-content',
            sizeClass
          ]"
        >
          <!-- 头部 -->
          <div v-if="title || $slots.header" class="flex items-center justify-between p-4 border-b dark:border-zinc-700">
            <slot name="header">
              <h3 class="font-semibold text-lg">{{ title }}</h3>
            </slot>
            <button 
              v-if="showClose"
              @click="handleClose"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition text-gray-400 hover:text-gray-600"
            >
              <Icon name="fa6-solid:xmark" class="text-lg" />
            </button>
          </div>
          
          <!-- 内容 -->
          <div :class="['p-4', { 'pt-6': !title && !$slots.header }]">
            <slot></slot>
          </div>
          
          <!-- 底部 -->
          <div v-if="$slots.footer" class="p-4 border-t dark:border-zinc-700 flex justify-end gap-2">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showClose: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const sizeClass = computed(() => {
  const sizes = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[500px]',
    xl: 'w-[600px]',
    full: 'w-[90vw] max-w-4xl',
  }
  return sizes[props.size]
})

function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style scoped>
/* 弹窗动画已移至 app.vue 全局样式 */
</style>

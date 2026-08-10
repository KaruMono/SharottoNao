<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" style="position: fixed;">
      <TransitionGroup name="toast">
        <div 
          v-for="toast in toasts" 
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm min-w-64 max-w-sm"
          :class="toastClasses[toast.type]"
        >
          <i :class="toastIcons[toast.type]"></i>
          <span class="flex-1 text-sm">{{ toast.message }}</span>
          <button 
            @click="remove(toast.id)"
            class="p-1 hover:bg-white/20 rounded transition"
          >
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { toasts, remove } = useToast()

const toastClasses: Record<string, string> = {
  success: 'bg-green-500/95 text-white',
  error: 'bg-red-500/95 text-white',
  warning: 'bg-amber-500/95 text-white',
  info: 'bg-gray-800/95 text-white dark:bg-zinc-700/95',
}

const toastIcons: Record<string, string> = {
  success: 'fa-solid fa-check-circle',
  error: 'fa-solid fa-times-circle',
  warning: 'fa-solid fa-exclamation-triangle',
  info: 'fa-solid fa-info-circle',
}
</script>

<style scoped>
.toast-enter-active {
  animation: toast-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
}

.toast-leave-active {
  position: absolute;
  right: 0;
  animation: toast-out 0.25s ease-in forwards;
}

.toast-move {
  transition: transform 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(calc(100% + 1rem)) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(calc(100% + 1rem)) scale(0.9);
  }
}
</style>

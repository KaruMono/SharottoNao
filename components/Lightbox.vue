<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div 
        v-if="show"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
        @click.self="emit('close')"
      >
        <!-- 关闭按钮 -->
        <button 
          @click="emit('close')"
          class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
        >
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>

        <!-- 上一张 -->
        <button 
          v-if="images.length > 1"
          @click="prev"
          class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
        >
          <i class="fa-solid fa-chevron-left text-xl"></i>
        </button>

        <!-- 图片 -->
        <div class="max-w-[90vw] max-h-[90vh] relative">
          <Transition name="img-switch" mode="out-in">
            <img 
              :key="currentIndex"
              :src="images[currentIndex]" 
              class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              @click.stop
            />
          </Transition>
          <!-- 计数器 -->
          <div 
            v-if="images.length > 1"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm"
          >
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </div>

        <!-- 下一张 -->
        <button 
          v-if="images.length > 1"
          @click="next"
          class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
        >
          <i class="fa-solid fa-chevron-right text-xl"></i>
        </button>

        <!-- 缩略图列表 -->
        <div 
          v-if="images.length > 1"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-lg bg-black/50"
        >
          <button 
            v-for="(img, index) in images" 
            :key="index"
            @click="currentIndex = index"
            class="w-16 h-12 rounded overflow-hidden border-2 transition"
            :class="index === currentIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-75'"
          >
            <img :src="img" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  images: string[]
  initialIndex?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const currentIndex = ref(props.initialIndex || 0)

// 当打开时重置索引
watch(() => props.show, (val) => {
  if (val) {
    currentIndex.value = props.initialIndex || 0
  }
})

// 当初始索引变化时更新
watch(() => props.initialIndex, (val) => {
  if (val !== undefined) {
    currentIndex.value = val
  }
})

function prev() {
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
}

function next() {
  currentIndex.value = (currentIndex.value + 1) % props.images.length
}

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  if (!props.show) return
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.lightbox-enter-active {
  animation: lightbox-in 0.2s ease-out;
}

.lightbox-leave-active {
  animation: lightbox-out 0.15s ease-in forwards;
}

@keyframes lightbox-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes lightbox-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
  }
}

/* 图片切换 */
.img-switch-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.img-switch-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.img-switch-enter-from {
  opacity: 0;
  transform: scale(0.97);
}
.img-switch-leave-to {
  opacity: 0;
  transform: scale(1.02);
}
</style>

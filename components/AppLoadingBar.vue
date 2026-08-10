<template>
  <Teleport to="body">
    <div
      v-show="visible"
      class="loading-bar"
      :class="{ 'loading-bar--done': done }"
      :style="{ width: `${progress}%` }"
    ></div>
  </Teleport>
</template>

<script setup lang="ts">
const progress = ref(0)
const visible = ref(false)
const done = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let doneTimer: ReturnType<typeof setTimeout> | null = null

function start() {
  done.value = false
  visible.value = true
  progress.value = 0
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (progress.value < 85) {
      progress.value += Math.random() * 8 + 2
      if (progress.value > 85) progress.value = 85
    }
  }, 200)
}

function finish() {
  if (timer) { clearInterval(timer); timer = null }
  progress.value = 100
  done.value = true
  doneTimer = setTimeout(() => {
    visible.value = false
    progress.value = 0
    done.value = false
  }, 400)
}

const router = useRouter()
const removeBeforeEach = router.beforeEach(() => { start() })
const removeAfterEach = router.afterEach(() => { finish() })

onBeforeUnmount(() => {
  removeBeforeEach()
  removeAfterEach()
  if (timer) clearInterval(timer)
  if (doneTimer) clearTimeout(doneTimer)
})
</script>

<style scoped>
.loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  height: 2.5px;
  background: linear-gradient(90deg, #6b7280, #9ca3af);
  transition: width 0.2s ease;
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(107, 114, 128, 0.6);
}
.dark .loading-bar {
  background: linear-gradient(90deg, #a1a1aa, #d4d4d8);
  box-shadow: 0 0 8px rgba(161, 161, 170, 0.5);
}
.loading-bar--done {
  transition: width 0.15s ease, opacity 0.3s ease 0.1s;
  opacity: 0;
}
</style>

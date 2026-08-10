<template>
  <div class="text-gray-800 dark:text-gray-100 min-h-screen bg-gray-100 dark:bg-zinc-900 flex flex-col">
    <!-- 顶部栏 -->
    <header class="fixed top-0 md:top-4 inset-x-0 z-50 pointer-events-none">
      <div class="max-w-6xl mx-auto px-0 md:px-4 pointer-events-auto">
        <div class="bg-white/70 dark:bg-zinc-800/70 backdrop-blur-xl md:rounded-2xl shadow-lg border-b md:border border-gray-200/40 dark:border-zinc-700/40">
          <div class="flex items-center px-4 md:px-6 h-14">
            <a href="/" class="text-lg font-semibold tracking-wide">
              {{ siteName }}
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 flex items-center justify-center pt-16 md:pt-24 pb-12 px-4">
      <div class="text-center max-w-md w-full">
        <!-- 错误码 -->
        <div class="mb-6 select-none">
          <div class="text-[120px] md:text-[160px] font-black leading-none text-gray-200 dark:text-zinc-700">
            {{ error?.statusCode || 404 }}
          </div>
        </div>

        <!-- 错误信息卡片 -->
        <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-6 md:p-8">
          <h1 class="text-xl md:text-2xl font-bold mb-2">
            {{ title }}
          </h1>
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {{ error?.message || '您访问的页面不存在或已被移除' }}
          </p>

          <!-- 倒计时提示 -->
          <div class="flex items-center justify-center gap-2 mb-3 text-sm text-gray-400 dark:text-zinc-500">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>{{ countdown }} 秒后自动返回主页</span>
          </div>

          <!-- 进度条 -->
          <div class="w-full h-1 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden mb-6">
            <div
              class="h-full bg-gray-400 dark:bg-zinc-500 rounded-full ease-linear"
              :style="{ width: `${progressWidth}%`, transition: started ? `width ${TOTAL}s linear` : 'none' }"
            ></div>
          </div>

          <!-- 按钮 -->
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/"
              class="px-5 py-2.5 rounded-xl bg-gray-800 dark:bg-zinc-600 text-white text-sm font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 transition flex items-center justify-center gap-2"
            >
              <i class="fa-solid fa-house"></i>
              返回主页
            </a>
            <button
              @click="handleBack"
              class="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
            >
              <i class="fa-solid fa-arrow-left"></i>
              返回上一页
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-gray-200 dark:border-zinc-800 py-6">
      <div class="max-w-7xl mx-auto px-4 md:px-6">
        <div class="flex items-center justify-center text-xs text-gray-500">
          <span>© {{ new Date().getFullYear() }} {{ siteName }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

// error.vue 不在完整的 Nuxt 路由上下文中，安全地获取 siteName
let siteName = ref('首页')
try {
  siteName = useSiteName()
} catch {}

const TOTAL = 3
const countdown = ref(TOTAL)
const progressWidth = ref(100)
const started = ref(false)

const title = computed(() => {
  switch (props.error?.statusCode) {
    case 404: return '页面不存在'
    case 403: return '无权访问'
    case 500: return '服务器错误'
    default: return '出错了'
  }
})

function goHome() {
  clearError({ redirect: '/' })
}

function handleBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    clearError({ redirect: '/' })
  }
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 下一帧触发进度条过渡动画（从 100% → 0%，持续 TOTAL 秒）
  nextTick(() => {
    started.value = true
    progressWidth.value = 0
  })

  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer!)
      goHome()
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

useHead({
  title: computed(() => `${props.error?.statusCode || 404} - ${title.value} | ${siteName.value}`),
})
</script>

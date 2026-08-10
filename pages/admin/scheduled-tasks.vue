<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">计划任务</h1>

    <div class="space-y-4">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :class="task.color">
              <i :class="task.icon"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h2 class="font-semibold">{{ task.name }}</h2>
                <span class="px-2 py-0.5 text-xs rounded-full font-medium" :class="task.statusClass">{{ task.statusLabel }}</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ task.description }}</p>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
                  <div class="text-xs text-gray-400 mb-0.5">执行频率</div>
                  <div class="text-sm font-medium">{{ task.schedule }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
                  <div class="text-xs text-gray-400 mb-0.5">执行条件</div>
                  <div class="text-sm font-medium">{{ task.condition }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-zinc-700/50 rounded-lg px-3 py-2">
                  <div class="text-xs text-gray-400 mb-0.5">实现方式</div>
                  <div class="text-sm font-medium font-mono">{{ task.file }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const siteName = useSiteName()
useHead({
  title: computed(() => `计划任务 - ${siteName.value}`),
})

const tasks = [
  {
    id: 'cleanup-codes',
    name: '过期验证码清理',
    description: '定期删除数据库中已过期的邮箱验证码，防止数据库垃圾数据堆积。',
    schedule: '每小时一次',
    condition: '启动后 30 秒执行首次，之后每小时循环',
    file: 'cleanup-codes.ts',
    icon: 'fa-solid fa-broom text-green-600 dark:text-green-400',
    color: 'bg-green-50 dark:bg-green-900/20',
    statusLabel: '运行中',
    statusClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  {
    id: 'indexnow-scheduled',
    name: 'IndexNow 定时提交',
    description: '每晚 23:00 后从游戏库中随机抽取 10 个非 NSFW 游戏页面提交到 IndexNow，在不超出每日配额的前提下提升搜索引擎收录效率。',
    schedule: '每分钟检查，每天触发一次',
    condition: '当前时间 ≥ 23:00，且今日尚未执行，且未达每日提交上限',
    file: 'indexnow-scheduled.ts',
    icon: 'fa-solid fa-bolt text-blue-600 dark:text-blue-400',
    color: 'bg-blue-50 dark:bg-blue-900/20',
    statusLabel: '运行中',
    statusClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
]
</script>

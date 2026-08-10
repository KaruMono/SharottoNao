<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">链接白名单管理</h1>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <div class="mb-4">
        <h2 class="font-semibold text-lg mb-2">关于链接过滤</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          为了保护用户安全，系统会自动过滤评论和攻略中的链接。只有白名单中的域名链接会被保留，其他链接会被自动移除（保留文本内容）。
        </p>
      </div>

      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <i class="fa-solid fa-info-circle text-blue-500 mt-0.5"></i>
          <div class="flex-1 text-sm">
            <p class="font-medium text-blue-900 dark:text-blue-100 mb-1">白名单规则</p>
            <ul class="text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>支持精确匹配和子域名匹配（如 example.com 会匹配 www.example.com）</li>
              <li>不区分大小写</li>
              <li>修改白名单需要重启应用才能生效</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
      <h2 class="font-semibold text-lg mb-4">当前白名单域名</h2>
      
      <div class="space-y-2 mb-4">
        <div 
          v-for="(domain, index) in (domains || [])" 
          :key="index"
          class="flex items-center gap-3 p-3 rounded-lg border dark:border-zinc-700"
        >
          <i class="fa-solid fa-globe text-gray-400"></i>
          <span class="flex-1 font-mono text-sm">{{ domain }}</span>
          <span 
            v-if="isOfficialDomain(domain)"
            class="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
          >
            官方
          </span>
        </div>
      </div>

      <div class="text-sm text-gray-500 dark:text-gray-400">
        共 {{ domains?.length ?? 0 }} 个域名
      </div>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mt-6">
      <h2 class="font-semibold text-lg mb-4">修改白名单</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        白名单配置在 <code class="bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded">server/utils/link-filter.ts</code> 文件中。
        修改后需要重启应用才能生效。
      </p>
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <i class="fa-solid fa-exclamation-triangle text-yellow-500 mt-0.5"></i>
          <div class="flex-1 text-sm">
            <p class="font-medium text-yellow-900 dark:text-yellow-100 mb-1">注意事项</p>
            <ul class="text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
              <li>请谨慎添加域名到白名单，确保域名安全可信</li>
              <li>不要添加短链接服务或可疑域名</li>
              <li>建议只添加官方网站和知名平台</li>
            </ul>
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
  title: computed(() => `链接白名单管理 - ${siteName.value}`),
})

// 加载白名单域名
const { data: domains } = await useAuthFetch<string[]>('/api/admin/link-whitelist', { key: 'admin-link-whitelist' })

function isOfficialDomain(domain: string): boolean {
  return domain.includes('sharotto.com')
}
</script>

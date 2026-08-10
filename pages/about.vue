<template>
  <div class="max-w-3xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-6 md:p-8 shadow">
      <h1 class="text-2xl font-bold mb-6">关于 Charlotte</h1>
      
      <div class="prose dark:prose-invert max-w-none">
        <p>
          Charlotte 是一个 Galgame（视觉小说）资源数据库，致力于收录和整理各类 Galgame 作品信息。
        </p>

        <h2>功能特点</h2>
        <ul>
          <li>丰富的游戏条目数据库</li>
          <li>用户协作编辑系统</li>
          <li>下载资源分享平台</li>
          <li>评分和评论功能</li>
          <li>收藏和个性化推荐</li>
        </ul>

        <h2>参与贡献</h2>
        <p>
          注册账号后，您可以：
        </p>
        <ul>
          <li>创建新的游戏条目</li>
          <li>完善现有条目信息</li>
          <li>分享下载资源链接</li>
          <li>参与社区讨论</li>
        </ul>

        <h2>免责声明</h2>
        <p>
          本站仅提供游戏信息索引服务，不提供游戏下载。所有下载链接由用户自行提交，
          请支持正版游戏。
        </p>

        <h2>联系方式</h2>
        <p>
          如有问题或建议，请联系站点管理员。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const siteName = useSiteName() as any
useHead({
  title: computed(() => `关于 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `关于 ${siteName.value} — Galgame 资源数据库，收录游戏作品信息、下载资源与社区评论。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `关于 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `关于 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

<style scoped>
.prose h2 {
  @apply text-lg font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100;
}

.prose p {
  @apply my-3 text-gray-700 dark:text-gray-300;
}

.prose ul {
  @apply my-3 pl-6 list-disc;
}

.prose li {
  @apply my-1 text-gray-700 dark:text-gray-300;
}
</style>

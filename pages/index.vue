<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 md:gap-10">

      <!-- 主内容区 -->
      <div class="min-w-0 space-y-5 md:space-y-7">
        <!-- 顶部广告（仅主内容区，不融入侧边栏） -->
        <AdBanner ad-slot="home_top" />
        <!-- 最新创建 -->
        <section>
          <h2 class="text-lg md:text-xl font-semibold mb-3 md:mb-4">最新创建</h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-5">
            <GameCard 
              v-for="(game, idx) in homeData?.latestGames" 
              :key="game.id" 
              :game="game"
              :eager="idx < 5"
            />
            <div v-if="!homeData?.latestGames?.length" key="empty" class="col-span-full text-center text-gray-500 py-8">
              暂无数据
            </div>
          </div>
        </section>

        <!-- 最新上传 -->
        <section>
          <h2 class="text-lg md:text-xl font-semibold mb-3 md:mb-4">最新上传</h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-5">
            <GameCard 
              v-for="(game, idx) in homeData?.recentlyUpdated" 
              :key="game.id" 
              :game="game"
            />
            <div v-if="!homeData?.recentlyUpdated?.length" key="empty" class="col-span-full text-center text-gray-500 py-8">
              暂无数据
            </div>
          </div>
        </section>

        <!-- 热门推荐 -->
        <section>
          <h2 class="text-lg md:text-xl font-semibold mb-3 md:mb-4">热门推荐</h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-5">
            <GameCard 
              v-for="(game, idx) in homeData?.popularGames" 
              :key="game.id" 
              :game="game"
            />
            <div v-if="!homeData?.popularGames?.length" key="empty" class="col-span-full text-center text-gray-500 py-8">
              暂无数据
            </div>
          </div>
        </section>
      </div>

      <!-- 右侧边栏 -->
      <aside class="space-y-4 md:space-y-6">
        <!-- 公告 -->
        <div v-if="homeData?.announcement" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <Icon name="fa6-solid:bullhorn" class="text-gray-400 text-sm" />
            <h3 class="font-medium text-sm">公告</h3>
          </div>
          <p class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ homeData.announcement }}</p>
        </div>

        <!-- 标签云 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <Icon name="fa6-solid:tags" class="text-gray-400 text-sm" />
            <h3 class="font-medium text-sm">标签</h3>
          </div>
          <div class="p-4 flex flex-wrap gap-2 text-xs">
            <NuxtLink 
              v-for="tag in homeData?.tags" 
              :key="tag.id"
              :to="`/tags/${tag.id}`"
              class="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition"
              :style="tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : {}"
            >
              {{ tag.name }}
            </NuxtLink>
          </div>
        </div>

        <!-- 最近评论 -->
        <div v-if="homeData?.recentComments?.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <Icon name="fa6-solid:comments" class="text-gray-400 text-sm" />
            <h3 class="font-medium text-sm">最近评论</h3>
          </div>
          <ul>
            <li v-for="comment in homeData.recentComments" :key="comment.id">
              <NuxtLink
                :to="`/games/${comment.game.id}`"
                class="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition"
              >
                <img
                  v-if="comment.user.avatar"
                  :src="comment.user.avatar"
                  class="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
                <div v-else class="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="fa6-solid:user" class="text-[9px] text-gray-400" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-1 mb-0.5">
                    <span class="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-600 dark:group-hover:text-gray-300 transition">{{ comment.user.username }}</span>
                    <ClientOnly>
                      <span class="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{{ formatTimeAgo(comment.createdAt) }}</span>
                    </ClientOnly>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">{{ comment.content }}</p>
                  <p class="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-0.5 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition">
                    <Icon name="fa6-solid:gamepad" class="mr-1" />{{ comment.game.title }}
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- 今日流量 -->
        <TrafficCard :traffic="homeData?.traffic" />

        <!-- 最近编辑 -->
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <Icon name="fa6-solid:clock-rotate-left" class="text-gray-400 text-sm" />
            <h3 class="font-medium text-sm">最近编辑</h3>
          </div>
          <ul>
            <li v-for="edit in homeData?.recentEdits" :key="edit.id">
              <NuxtLink
                :to="`/games/${edit.game.id}`"
                class="flex items-start gap-2 px-4 py-2.5 group hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition"
              >
                <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="fa6-solid:pen" class="text-[9px] text-gray-400" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">
                    <span class="font-semibold text-gray-800 dark:text-gray-200">{{ edit.user.username }}</span>
                    {{ edit.action }}
                  </p>
                  <p class="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-0.5 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition">
                    <Icon name="fa6-solid:gamepad" class="mr-1" />{{ edit.game.title }}
                  </p>
                </div>
              </NuxtLink>
            </li>
            <li v-if="!homeData?.recentEdits?.length" class="px-4 py-2.5 text-xs text-gray-500">暂无编辑记录</li>
          </ul>
        </div>

        <!-- 侧边栏广告 -->
        <AdBanner ad-slot="home_sidebar" />

        <!-- 友情链接 -->
        <div v-if="homeData?.friendLinks?.length" class="bg-white dark:bg-zinc-800 rounded-xl shadow">
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <Icon name="fa6-solid:link" class="text-gray-400 text-sm" />
            <h3 class="font-medium text-sm">友情链接</h3>
          </div>
          <div class="p-4 flex flex-wrap gap-2 text-sm">
            <div 
              v-for="link in homeData.friendLinks" 
              :key="link.id"
              class="relative group/friendlink"
            >
              <a 
                :href="link.url" 
                target="_blank"
                rel="noopener"
                class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition inline-block text-xs"
              >
                {{ link.name }}
              </a>
              <div v-if="link.description" class="header-tooltip">{{ link.description }}</div>
            </div>
          </div>
        </div>
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { HomeResponse } from '~/types/api'

// 获取首页数据（需要带 auth token 以正确过滤 NSFW 内容）
const { data: homeData } = await useAuthFetch<HomeResponse>('/api/home', { key: 'home-data' })

const { formatDate: formatTimeAgo } = useFormatDate()

const siteName = useSiteName()
const runtimeConfig = useRuntimeConfig()
// SEO
useHead({
  title: computed(() => homeData.value?.homeTitle || homeData.value?.siteName || siteName.value),
  meta: computed(() => {
    const metas: any[] = [
      { name: 'description', content: homeData.value?.siteDescription || 'Galgame 资源数据库' },
      { property: 'og:title', content: homeData.value?.homeTitle || homeData.value?.siteName || siteName.value },
      { property: 'og:description', content: homeData.value?.siteDescription || 'Galgame 资源数据库' },
      { property: 'og:type', content: 'website' },
    ]
    // 使用首个游戏封面作为 og:image；同步调整 twitter:card 类型
    const ogImage = homeData.value?.latestGames?.[0]?.coverImage || homeData.value?.favicon
    if (ogImage) {
      metas.push({ property: 'og:image', content: ogImage })
      metas.push({ name: 'twitter:card', content: 'summary_large_image' })
      metas.push({ name: 'twitter:image', content: ogImage })
    } else {
      metas.push({ name: 'twitter:card', content: 'summary' })
    }
    metas.push({ name: 'twitter:title', content: homeData.value?.homeTitle || homeData.value?.siteName || siteName.value })
    metas.push({ name: 'twitter:description', content: homeData.value?.siteDescription || 'Galgame 资源数据库' })
    return metas
  }),
})
</script>

<style scoped>
/* 友情链接气泡提示 */
.header-tooltip {
  @apply absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-zinc-600 rounded opacity-0 pointer-events-none transition-opacity duration-200 z-50 text-left;
  width: max-content;
  max-width: min(20rem, calc(100vw - 2rem));
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.group\/friendlink:hover .header-tooltip {
  @apply opacity-100;
}
</style>

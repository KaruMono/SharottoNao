<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="mb-8">
      <h1 class="text-2xl font-bold">搜索结果</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        关键词：<span class="font-medium text-gray-800 dark:text-gray-200">{{ query }}</span>
      </p>
    </div>

    <div v-if="searchData" class="space-y-10">
      <!-- 游戏结果 -->
      <section v-if="searchData.games?.items?.length">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="fa6-solid:gamepad" class="text-gray-400" />游戏
        </h2>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-5">
          <GameCard 
            v-for="game in searchData.games.items" 
            :key="game.id" 
            :game="game"
          />
        </div>
        <Pagination
          v-if="searchData.games.totalPages > 1"
          class="mt-6"
          :current-page="searchData.games.page"
          :total-pages="searchData.games.totalPages"
          @page-change="(p) => onPageChange(p)"
        />
      </section>

      <!-- 会社结果 -->
      <section v-if="searchData.companies?.items?.length">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="fa6-solid:building" class="text-gray-400" />会社
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink 
            v-for="company in searchData.companies.items" 
            :key="company.id"
            :to="`/companies/${company.id}`"
            class="flex items-center gap-4 bg-white dark:bg-zinc-800 rounded-xl p-4 shadow hover:shadow-lg transition"
          >
            <div class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
              <img v-if="company.logo" :src="company.logo" class="w-full h-full rounded-lg object-cover" />
              <Icon name="fa6-solid:building" class="text-gray-400" v-else />
            </div>
            <div>
              <div class="font-medium">{{ company.name }}</div>
              <div class="text-sm text-gray-500">{{ company._count?.games || 0 }} 部作品</div>
            </div>
          </NuxtLink>
        </div>
        <Pagination
          v-if="searchData.companies.totalPages > 1"
          class="mt-6"
          :current-page="searchData.companies.page"
          :total-pages="searchData.companies.totalPages"
          @page-change="(p) => onPageChange(p)"
        />
      </section>

      <!-- 标签结果 -->
      <section v-if="searchData.tags?.items?.length">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="fa6-solid:tags" class="text-gray-400" />标签
        </h2>
        <div class="flex flex-wrap gap-3">
          <NuxtLink 
            v-for="tag in searchData.tags.items" 
            :key="tag.id"
            :to="`/tags/${tag.id}`"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 shadow hover:shadow-lg transition"
            :style="tag.color ? { borderLeft: `3px solid ${tag.color}` } : {}"
          >
            <span class="font-medium">{{ tag.name }}</span>
            <span class="text-sm text-gray-500">({{ tag._count?.games || 0 }})</span>
          </NuxtLink>
        </div>
        <Pagination
          v-if="searchData.tags.totalPages > 1"
          class="mt-6"
          :current-page="searchData.tags.page"
          :total-pages="searchData.tags.totalPages"
          @page-change="(p) => onPageChange(p)"
        />
      </section>

      <!-- 无结果 -->
      <div 
        v-if="!searchData.games?.items?.length && !searchData.companies?.items?.length && !searchData.tags?.items?.length"
        class="text-center text-gray-500 py-16"
      >
        <Icon name="fa6-solid:magnifying-glass" class="text-4xl mb-4" />
        <p>没有找到相关结果</p>
        <p v-if="isLoggedInSfw" class="mt-2 text-sm">
          部分内容仅在开启 NSFW 过滤后可见，请在顶栏设置中切换过滤模式后再试
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyItem, GameCardItem, TagItem } from '~/types/api'

type SearchBucket<T> = {
  items: T[]
  page: number
  totalPages: number
}

type SearchResponse = {
  games?: SearchBucket<GameCardItem>
  companies?: SearchBucket<CompanyItem & { _count?: { games: number } }>
  tags?: SearchBucket<TagItem & { color?: string | null; _count?: { games: number } }>
}

const route = useRoute()
const router = useRouter()
const { data: session, status } = useAuth()
const isLoggedInSfw = computed(() => {
  const user = session.value as any
  return status.value === 'authenticated' && (!user?.nsfwMode || user.nsfwMode === 'SFW')
})

const query = computed(() => route.query.q as string || '')
const page = computed(() => Number(route.query.page) || 1)

const { data: searchData } = await useAuthFetch<SearchResponse>('/api/search', {
  key: 'search-results',
  query: computed(() => ({
    q: query.value,
    type: route.query.type || 'all',
    limit: 20,
    page: page.value,
  })),
  immediate: !!query.value,
})

function onPageChange(newPage: number) {
  router.push({
    path: route.path,
    query: { ...route.query, page: newPage },
  })
}

const siteName = useSiteName()
useHead({
  title: computed(() => query.value ? `站内搜索结果：${query.value} 相关 Galgame 条目 - ${siteName.value}` : `站内搜索 Galgame 游戏、会社与标签 - ${siteName.value}`),
  meta: computed(() => [
    {
      name: 'description',
      content: query.value ? `查看与 ${query.value} 相关的 Galgame 游戏、会社和标签搜索结果。搜索结果页不参与搜索引擎索引，以避免重复和低质量页面。` : '使用 Charlotte 站内搜索查找 Galgame 游戏、制作会社、标签分类和资源条目。',
    },
    { name: 'robots', content: 'noindex, follow', key: 'robots' },
  ]),
})
</script>

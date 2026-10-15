<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 py-6">
    <h1 class="text-2xl font-bold mb-6">游戏系列</h1>

    <!-- 搜索栏 -->
    <div class="w-full mb-6">
      <div class="flex w-full flex-col overflow-hidden bg-white dark:bg-zinc-800 rounded-2xl ring-1 ring-gray-200 dark:ring-zinc-700/70">
        <div class="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1.5 m-0 transition-colors rounded-2xl">
          <label class="relative w-full cursor-text border-0 bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-200 ring-1 ring-gray-200 dark:ring-zinc-700 outline-none focus:outline-none h-10 text-base focus-within:ring-[1.5px] focus-within:ring-gray-400 dark:focus-within:ring-zinc-500 overflow-hidden px-0 flex items-center gap-0 rounded-xl mb-0">
            <div class="pointer-events-none relative z-[1] flex shrink-0 items-center gap-1.5 text-gray-400 dark:text-gray-500 text-base pl-2.5 pr-0">
              <Icon name="fa6-solid:magnifying-glass" class="w-4 h-4" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索系列名称..."
              class="text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 gap-2 text-base flex h-full min-w-0 grow items-center border-0 bg-transparent font-sans px-4 text-ellipsis relative z-1 shadow-none outline-none focus:outline-none rounded-xl ring-0"
              @keyup.enter="handleSearch"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- 系列列表 -->
    <div v-if="seriesData?.items?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div 
        v-for="series in seriesData.items" 
        :key="series.id"
        class="bg-white dark:bg-zinc-800 rounded-xl shadow hover:shadow-lg transition-all overflow-hidden group"
        @mouseenter="hoveredSeriesId = series.id"
        @mouseleave="hoveredSeriesId = null"
      >
        <NuxtLink :to="`/series/${series.id}`" class="block">
          <!-- 系列信息 -->
          <div class="p-4">
            <div class="flex items-start gap-3">
              <img 
                v-if="series.coverImage || series.games?.[0]?.coverImage"
                :src="series.coverImage || series.games?.[0]?.coverImage || undefined" 
                :alt="series.name"
                class="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
              <div v-else class="w-16 h-16 rounded-lg bg-gray-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                <Icon name="fa6-solid:layer-group" class="text-gray-400 text-xl" />
              </div>
              
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold truncate">{{ series.name }}</h3>
                  <span v-if="series.isNsfw" class="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded font-medium flex-shrink-0">NSFW</span>
                </div>
                <p v-if="series.nameOriginal" class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                  {{ series.nameOriginal }}
                </p>
                <div class="text-xs text-gray-500">
                  {{ series.gamesCount }} 个游戏
                </div>
              </div>
            </div>
            
            <p v-if="series.description" class="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">
              {{ series.description }}
            </p>
          </div>
        </NuxtLink>

        <!-- 悬停展开：显示游戏封面 -->
        <Transition name="slide-expand">
          <div 
            v-if="hoveredSeriesId === series.id && series.games?.length"
            class="border-t dark:border-zinc-700 p-3 bg-gray-50 dark:bg-zinc-900/50"
          >
            <div class="grid grid-cols-4 gap-2">
              <NuxtLink 
                v-for="(game, gi) in series.games.slice(0, 8)" 
                :key="game.id"
                :to="`/games/${game.id}`"
                class="aspect-[3/4] rounded-lg overflow-hidden game-cover-item relative group/game"
                :style="{ animationDelay: `${gi * 40}ms` }"
              >
                <img 
                  v-if="game.coverImage"
                  :src="game.coverImage" 
                  :alt="game.title"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover/game:scale-105"
                />
                <div 
                  v-else
                  class="w-full h-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center"
                >
                  <Icon name="fa6-solid:gamepad" class="text-gray-400 text-xs" />
                </div>
                <div class="absolute inset-0 bg-black/0 group-hover/game:bg-black/20 transition-colors duration-200 rounded-lg"></div>
              </NuxtLink>
            </div>
            <NuxtLink 
              :to="`/series/${series.id}`"
              class="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <span>查看全部 {{ series.gamesCount }} 个游戏</span>
              <Icon name="fa6-solid:arrow-right" class="text-[10px]" />
            </NuxtLink>
          </div>
        </Transition>
      </div>
    </div>

    <div v-else-if="!pending" class="text-center py-12 text-gray-500">
      <Icon name="fa6-solid:layer-group" class="text-4xl mb-4" />
      <p>暂无系列</p>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="seriesData && seriesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="seriesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import type { ListResponse, SeriesItem } from '~/types/api'

const route = useRoute()
const router = useRouter()
const siteName = useSiteName()

const searchQuery = ref(route.query.search as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const hoveredSeriesId = ref<number | null>(null)

// 获取系列列表
const { data: seriesData, pending } = await useAuthFetch<ListResponse<SeriesItem>>('/api/series', {
  key: 'series-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: 12,
    search: searchQuery.value || undefined,
  })),
})

function handleSearch() {
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
}

function updateUrl() {
  router.push({
    query: {
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

useHead({
  title: computed(() => `游戏系列 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 收录的 Galgame 系列合集，浏览系列简介与关联作品。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `游戏系列 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `游戏系列 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

<style scoped>
.slide-expand-enter-active {
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-expand-leave-active {
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.2s ease;
  max-height: 300px;
  overflow: hidden;
}

.slide-expand-enter-from {
  max-height: 0;
  opacity: 0;
}

.slide-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

@keyframes coverPopIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.game-cover-item {
  animation: coverPopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>

<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div v-if="tagData">
      <!-- 标签信息 -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold flex items-center gap-3">
          <span 
            class="inline-block w-4 h-4 rounded"
            :style="{ backgroundColor: tagData.color || '#6b7280' }"
          ></span>
          {{ tagData.name }}
        </h1>
        <p v-if="tagData.description" class="text-gray-600 dark:text-gray-400 mt-2">
          {{ tagData.description }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          共 {{ tagData.gamesCount }} 个相关条目
        </p>
      </div>

      <!-- 游戏列表 -->
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-5">
        <GameCard 
          v-for="game in tagData.games" 
          :key="game.id" 
          :game="game" 
        />
      </div>

      <div v-if="!tagData.games?.length" class="text-center text-gray-500 py-16">
        <Icon name="fa6-solid:gamepad" class="text-4xl mb-4" />
        <p>暂无相关游戏</p>
      </div>

      <!-- 分页 -->
      <Pagination 
        v-if="tagData.pagination.totalPages > 1"
        :current-page="currentPage"
        :total-pages="tagData.pagination.totalPages"
        @page-change="handlePageChange"
        class="mt-10"
      />
    </div>

    <!-- 加载中 -->
    <div v-else-if="pending" class="text-center py-20">
      <Icon name="fa6-solid:spinner" class="fa-spin text-3xl text-gray-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagDetailResponse } from '~/types/api'

const route = useRoute()
const router = useRouter()

// 支持 ID 或 slug
const tagIdOrSlug = computed(() => route.params.id as string)
const currentPage = ref(parseInt(route.query.page as string) || 1)

const { data: tagData, pending } = await useAuthFetch<TagDetailResponse>(() => `/api/tags/${tagIdOrSlug.value}`, {
  key: `tag-${tagIdOrSlug.value}`,
  query: computed(() => ({
    page: currentPage.value,
    limit: 20,
  })),
  watch: [tagIdOrSlug],
})

function handlePageChange(page: number) {
  currentPage.value = page
  router.push({ query: { page } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const siteName = useSiteName()
useHead({
  title: computed(() => tagData.value ? `${tagData.value.name} - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    if (!tagData.value) return []
    const desc = tagData.value.description
      || `${tagData.value.name} 相关 Galgame 作品，共 ${tagData.value.gamesCount} 个条目。`
    const title = `${tagData.value.name} - ${siteName.value}`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

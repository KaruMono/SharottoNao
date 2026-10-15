<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
      <h1 class="text-2xl font-bold">标签列表</h1>
      <div class="sm:ml-auto text-sm text-gray-500 dark:text-gray-400">
        共 {{ tagsData?.pagination.total ?? 0 }} 个标签
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl px-3 sm:px-4 py-3 shadow mb-5 flex items-center gap-3">
      <Icon name="fa6-solid:magnifying-glass" class="text-gray-400" />
      <input
        v-model="searchInput"
        type="text"
        placeholder="搜索标签名称..."
        class="flex-1 bg-transparent outline-none text-sm placeholder-gray-400"
        @input="onSearchInput"
      />
      <button v-if="searchInput" @click="clearSearch" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
        <Icon name="fa6-solid:xmark" />
      </button>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow">
      <!-- 标签网格 -->
      <div v-if="tagsData?.items?.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <NuxtLink 
          v-for="tag in tagsData.items" 
          :key="tag.id"
          :to="`/tags/${tag.id}`"
          class="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl border border-transparent hover:border-current transition-all"
          :style="tag.color ? { backgroundColor: tag.color + '15', color: tag.color } : { backgroundColor: 'rgba(107,114,128,0.08)', color: 'inherit' }"
        >
          <span
            class="hidden sm:inline-block w-2.5 h-2.5 rounded-full shrink-0"
            :style="tag.color ? { backgroundColor: tag.color } : { backgroundColor: '#9ca3af' }"
          ></span>
          <span class="font-medium text-sm truncate flex-1">{{ tag.name }}</span>
          <span class="text-xs opacity-60 shrink-0">{{ tag.gamesCount }}</span>
        </NuxtLink>
      </div>

      <div v-else-if="pending" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div v-for="i in 40" :key="i" class="h-12 rounded-xl bg-gray-100 dark:bg-zinc-700 animate-pulse"></div>
      </div>

      <div v-else class="text-center text-gray-500 py-12">
        <Icon name="fa6-solid:tags" class="text-4xl mb-3 opacity-30" />
        <p>{{ searchInput ? '没有找到匹配的标签' : '暂无标签' }}</p>
      </div>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="tagsData && tagsData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="tagsData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-8"
    />
  </div>
</template>

<script setup lang="ts">
import type { ListResponse, TagItem } from '~/types/api'

const route = useRoute()
const router = useRouter()

const currentPage = ref(parseInt(route.query.page as string) || 1)
const searchInput = ref((route.query.search as string) || '')
const debouncedSearch = ref(searchInput.value)
let searchTimer: ReturnType<typeof setTimeout>

const { data: tagsData, pending } = await useAuthFetch<ListResponse<TagItem>>('/api/tags', {
  key: 'tags-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: 40,
    search: debouncedSearch.value || undefined,
  })),
})

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = searchInput.value
    currentPage.value = 1
    updateUrl()
  }, 300)
}

function clearSearch() {
  searchInput.value = ''
  debouncedSearch.value = ''
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateUrl() {
  const query: Record<string, string> = {}
  if (currentPage.value > 1) query.page = String(currentPage.value)
  if (debouncedSearch.value) query.search = debouncedSearch.value
  router.push({ query })
}

const siteName = useSiteName()
useHead({
  title: computed(() => `标签分类 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 的 Galgame 标签与题材分类，按标签浏览相关作品。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `标签分类 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `标签分类 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

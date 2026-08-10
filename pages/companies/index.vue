<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    
    <!-- 页面标题与筛选 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold">会社一览</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          共收录 <span class="font-medium text-gray-700 dark:text-gray-200">{{ companiesData?.pagination.total || 0 }}</span> 家会社
        </p>
      </div>
      
      <!-- 筛选与排序 -->
      <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <div class="relative w-full md:w-auto">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索会社名..." 
            class="w-full md:w-48 h-9 px-3 py-2 pl-9 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            @keyup.enter="handleSearch"
          />
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
        </div>
        
        <!-- 排序下拉菜单 -->
        <div class="relative" ref="sortMenuRef">
          <button 
            @click="showSortMenu = !showSortMenu"
            class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2 whitespace-nowrap"
          >
            <i :class="sortOptions.find(o => o.value === sortBy)?.icon || 'fa-solid fa-sort'" class="text-gray-400"></i>
            <span>{{ sortOptions.find(o => o.value === sortBy)?.label || '排序' }}</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </button>
          <Transition name="dropdown">
            <div 
              v-if="showSortMenu"
              class="absolute left-0 md:left-auto md:right-0 mt-2 w-44 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-50"
            >
              <button 
                v-for="option in sortOptions"
                :key="option.value"
                @click="selectSort(option.value)"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors"
                :class="{ 'text-gray-900 dark:text-white font-medium': sortBy === option.value }"
              >
                <i :class="option.icon" class="w-4 text-gray-400"></i>
                {{ option.label }}
                <i v-if="sortBy === option.value" class="fa-solid fa-check ml-auto text-green-500"></i>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 字母索引 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow mb-8">
      <div class="flex flex-wrap gap-2 text-sm">
        <span class="text-gray-500 dark:text-gray-400 mr-2">索引：</span>
        <button 
          @click="indexFilter = ''"
          class="px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
          :class="{ 'bg-gray-200 dark:bg-zinc-600 font-medium': indexFilter === '' }"
        >
          全部
        </button>
        <button 
          v-for="letter in alphabet" 
          :key="letter"
          @click="indexFilter = letter"
          class="px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
          :class="{ 'bg-gray-200 dark:bg-zinc-600 font-medium': indexFilter === letter }"
        >
          {{ letter }}
        </button>
      </div>
    </div>

    <!-- 会社列表 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink 
        v-for="company in companiesData?.items" 
        :key="company.id"
        :to="`/companies/${company.id}`"
        class="flex items-center gap-4 bg-white dark:bg-zinc-800 rounded-xl p-4 shadow hover:shadow-lg hover:scale-[1.01] transition group"
      >
        <div class="w-14 h-14 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center text-gray-400 dark:text-zinc-400 group-hover:text-gray-600 dark:group-hover:text-zinc-200 transition overflow-hidden">
          <img v-if="company.logo" :src="company.logo" class="w-full h-full object-cover" />
          <i v-else class="fa-solid fa-building text-xl"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-base group-hover:text-gray-600 dark:group-hover:text-white transition truncate">
            {{ company.name }}
          </h3>
          <p v-if="company.nameOriginal" class="text-xs text-gray-500 dark:text-zinc-500 truncate">
            {{ company.nameOriginal }}
          </p>
          <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-zinc-500">
            <span>共 <span class="font-medium text-gray-700 dark:text-zinc-300">{{ company.gamesCount }}</span> 部作品</span>
            <span v-if="company.foundedYear">{{ company.foundedYear }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- 空状态 -->
    <div v-if="!companiesData?.items?.length" class="text-center text-gray-500 py-16">
      <i class="fa-solid fa-building text-4xl mb-4"></i>
      <p>暂无会社数据</p>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="companiesData && companiesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="companiesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-10"
    />
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const route = useRoute()
const router = useRouter()

// 状态
const searchQuery = ref(route.query.search as string || '')
const sortBy = ref(route.query.sort as string || 'games')
const indexFilter = ref(route.query.index as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const showSortMenu = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)

const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#']

// 排序选项
const sortOptions = [
  { value: 'games', label: '按作品数', icon: 'fa-solid fa-gamepad' },
  { value: 'name', label: '按名称', icon: 'fa-solid fa-font' },
  { value: 'founded', label: '按成立时间', icon: 'fa-solid fa-calendar' },
]

// 点击外部关闭菜单
onClickOutside(sortMenuRef, () => {
  showSortMenu.value = false
})

function selectSort(value: string) {
  sortBy.value = value
  showSortMenu.value = false
  handleSort()
}

// 获取数据
const { data: companiesData } = await useFetch('/api/companies', {
  key: 'companies-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: 12,
    search: searchQuery.value || undefined,
    index: indexFilter.value || undefined,
    sort: sortBy.value,
  })),
})

// 监听索引变化
watch(indexFilter, () => {
  currentPage.value = 1
  updateUrl()
})

// 方法
function handleSearch() {
  currentPage.value = 1
  updateUrl()
}

function handleSort() {
  currentPage.value = 1
  updateUrl()
}

function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function updateUrl() {
  router.push({
    query: {
      ...(searchQuery.value && { search: searchQuery.value }),
      ...(sortBy.value !== 'games' && { sort: sortBy.value }),
      ...(indexFilter.value && { index: indexFilter.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
    },
  })
}

const siteName = useSiteName()
// SEO
useHead({
  title: computed(() => `制作会社 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 收录的 Galgame 制作会社与发行商，查看会社作品列表。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `制作会社 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `制作会社 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

<style scoped>
/* 下拉菜单动画 */
.dropdown-enter-active {
  animation: dropdown-in 0.2s ease-out;
}

.dropdown-leave-active {
  animation: dropdown-out 0.15s ease-in forwards;
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dropdown-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
}
</style>

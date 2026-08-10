<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <!-- 游戏列表顶部横幅广告 -->
    <AdBanner ad-slot="game_list_top" class="mb-6" />

    <!-- 页面标题与筛选 -->
    <div class="flex flex-col gap-4 mb-6 md:mb-8">
      <div>
        <h1 class="text-xl md:text-2xl font-bold">游戏列表</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          共收录 <span class="font-medium text-gray-700 dark:text-gray-200">{{ gamesData?.pagination.total || 0 }}</span> 个条目
        </p>
      </div>
      
      <!-- 筛选与排序 -->
      <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <!-- 搜索框：手机端满宽独占一行，桌面端定宽 -->
        <div class="relative w-full md:w-auto md:flex-1 md:min-w-[140px] md:max-w-[200px]">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索游戏..." 
            class="w-full h-9 px-3 py-2 pl-9 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            @keyup.enter="handleSearch"
          />
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
        </div>

        <!-- 按钮组：手机端第二行，桌面端和搜索框同一行 -->
        <div class="flex items-center gap-2 md:gap-3">
        <!-- 高级筛选按钮 -->
        <button
          @click="showAdvancedFilter = !showAdvancedFilter"
          class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          :class="{ 'border-gray-800 dark:border-zinc-400': hasActiveFilters }"
        >
          <i class="fa-solid fa-filter text-gray-400"></i>
          <span class="hidden sm:inline">筛选</span>
          <span v-if="hasActiveFilters" class="w-2 h-2 bg-gray-800 dark:bg-white rounded-full"></span>
        </button>
        
        <!-- 年份过滤 -->
        <div class="relative" ref="yearMenuRef">
          <button
            @click="showYearMenu = !showYearMenu"
            class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          >
            <i class="fa-solid fa-calendar text-gray-400"></i>
            <span class="hidden sm:inline">{{ filterYear || '全部年份' }}</span>
            <span class="sm:hidden">{{ filterYear || '年份' }}</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </button>
          <Transition name="dropdown">
            <div 
              v-if="showYearMenu"
              class="absolute right-0 mt-2 w-36 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-50 origin-top-right max-h-64 overflow-y-auto"
            >
              <button
                @click="selectYear('')"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                :class="{ 'text-gray-900 dark:text-white font-medium': !filterYear }"
              >
                全部年份
                <i v-if="!filterYear" class="fa-solid fa-check ml-auto text-green-500"></i>
              </button>
              <button
                v-for="year in yearOptions"
                :key="year"
                @click="selectYear(year)"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                :class="{ 'text-gray-900 dark:text-white font-medium': filterYear === year }"
              >
                {{ year }}年
                <i v-if="filterYear === year" class="fa-solid fa-check ml-auto text-green-500"></i>
              </button>
            </div>
          </Transition>
        </div>

        <!-- 月份过滤 - 移动端隐藏 -->
        <div class="relative hidden sm:block" ref="monthMenuRef">
          <button
            @click="showMonthMenu = !showMonthMenu"
            class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          >
            <i class="fa-regular fa-calendar text-gray-400"></i>
            <span>{{ filterMonth ? filterMonth + '月' : '全部月份' }}</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </button>
          <Transition name="dropdown">
            <div 
              v-if="showMonthMenu"
              class="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-50 origin-top-right max-h-64 overflow-y-auto"
            >
              <button
                @click="selectMonth('')"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                :class="{ 'text-gray-900 dark:text-white font-medium': !filterMonth }"
              >
                全部月份
              </button>
              <button
                v-for="month in 12"
                :key="month"
                @click="selectMonth(month.toString())"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                :class="{ 'text-gray-900 dark:text-white font-medium': filterMonth === month.toString() }"
              >
                {{ month }}月
              </button>
            </div>
          </Transition>
        </div>
        
        <!-- 排序下拉菜单 -->
        <div class="relative" ref="sortMenuRef">
          <button
            @click="showSortMenu = !showSortMenu"
            class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          >
            <i :class="sortOptions.find(o => o.value === sortBy)?.icon || 'fa-solid fa-sort'" class="text-gray-400"></i>
            <span class="hidden sm:inline">{{ sortOptions.find(o => o.value === sortBy)?.label || '排序' }}</span>
            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
          </button>
          <Transition name="dropdown">
            <div 
              v-if="showSortMenu"
              class="absolute right-0 mt-2 w-44 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-50 origin-top-right"
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

        <!-- 排序方向切换 -->
        <button
          @click="toggleSortOrder"
          class="h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          :title="sortOrder === 'desc' ? '倒序' : '正序'"
        >
          <i 
            class="fa-solid text-gray-400 transition-transform"
            :class="sortOrder === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-wide-short'"
          ></i>
        </button>
        </div>
      </div>
    </div>

    <!-- 高级筛选面板 -->
    <Transition name="slide">
      <div v-if="showAdvancedFilter" class="bg-white dark:bg-zinc-800 rounded-xl p-5 shadow mb-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 会社筛选 -->
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">会社</label>
            <div v-if="selectedCompany" class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg">
              <span class="text-sm font-medium flex-1">{{ selectedCompany.name }}</span>
              <button @click="clearCompanyFilter" class="text-gray-400 hover:text-red-500">
                <i class="fa-solid fa-times text-xs"></i>
              </button>
            </div>
            <div v-else class="relative" ref="companyDropdownRef">
              <input 
                v-model="companySearchQuery"
                type="text" 
                placeholder="搜索会社名称..."
                class="w-full px-3 py-2 pl-8 rounded-lg bg-gray-100 dark:bg-zinc-700 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                @input="searchFilterCompanies"
                @focus="showCompanyDropdown = true"
              />
              <i class="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <div 
                v-if="showCompanyDropdown && filterCompanyResults.length"
                class="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-auto"
              >
                <button
                  v-for="c in filterCompanyResults" :key="c.id"
                  type="button"
                  class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-600 text-sm"
                  @click="selectCompanyFilter(c)"
                >
                  <span class="font-medium">{{ c.name }}</span>
                  <span v-if="c.nameOriginal" class="text-gray-500 ml-1.5 text-xs">{{ c.nameOriginal }}</span>
                </button>
              </div>
            </div>
          </div>
          <!-- 评分筛选 -->
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">评分区间</label>
            <div class="flex items-center gap-2">
              <select v-model="filterRatingMin" class="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 border-0 text-sm focus:ring-1 focus:ring-gray-400">
                <option value="">不限</option>
                <option v-for="i in 5" :key="i" :value="i">{{ i }} 星以上</option>
              </select>
            </div>
          </div>
          <!-- 标签筛选 -->
          <div class="md:col-span-2">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">标签筛选</label>
            <div v-if="tagsData?.length" class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              <button
                v-for="tag in tagsData" 
                :key="tag.id"
                @click="toggleTagFilter(tag.id)"
                class="px-2 py-1 rounded text-xs transition"
                :class="selectedTagIds.includes(tag.id) 
                  ? 'bg-gray-800 dark:bg-zinc-500 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'"
                :style="selectedTagIds.includes(tag.id) && tag.color ? { backgroundColor: tag.color } : {}"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
          <!-- 资源筛选 -->
          <div>
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">资源筛选</label>
            <div class="flex flex-wrap gap-2">
              <button
                @click="filterHasResource = filterHasResource === 'true' ? '' : 'true'"
                class="px-2 py-1 rounded text-xs transition"
                :class="filterHasResource === 'true'
                  ? 'bg-gray-800 dark:bg-zinc-500 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'"
              >
                有资源
              </button>
              <button
                @click="filterHasResource = filterHasResource === 'false' ? '' : 'false'"
                class="px-2 py-1 rounded text-xs transition"
                :class="filterHasResource === 'false'
                  ? 'bg-gray-800 dark:bg-zinc-500 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'"
              >
                无资源
              </button>
              <button
                @click="filterHasMachineTranslation = filterHasMachineTranslation === 'true' ? '' : 'true'"
                class="px-2 py-1 rounded text-xs transition"
                :class="filterHasMachineTranslation === 'true'
                  ? 'bg-gray-800 dark:bg-zinc-500 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-600'"
              >
                <i class="fa-solid fa-language mr-1"></i>有机翻资源
              </button>
            </div>
            <select
              v-model="filterResourceTypeId"
              class="mt-2 w-full px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 border-0 text-sm focus:ring-1 focus:ring-gray-400"
            >
              <option value="">全部资源类型</option>
              <option v-for="type in resourceTypes || []" :key="type.id" :value="String(type.id)">
                {{ type.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t dark:border-zinc-700">
          <button @click="clearAdvancedFilters" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">清除筛选</button>
          <button @click="applyAdvancedFilters" class="px-3 py-1.5 text-sm bg-gray-800 dark:bg-zinc-600 text-white rounded-lg hover:bg-gray-700">应用</button>
        </div>
      </div>
    </Transition>

    <!-- 游戏列表 -->
    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-5">
      <GameCard 
        v-for="game in gamesData?.items" 
        :key="game.id" 
        :game="game"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="!gamesData?.items?.length" class="text-center text-gray-500 py-16">
      <i class="fa-solid fa-gamepad text-4xl mb-4"></i>
      <p>暂无游戏条目</p>
    </div>

    <!-- 分页 -->
    <Pagination 
      v-if="gamesData && gamesData.pagination.totalPages > 1"
      :current-page="currentPage"
      :total-pages="gamesData.pagination.totalPages"
      @page-change="handlePageChange"
      class="mt-10"
    />
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import type { CompanyItem, GameCardItem, ListResponse, ResourceTypeItem, TagItem } from '~/types/api'

const route = useRoute()
const router = useRouter()

// 状态
const searchQuery = ref(route.query.search as string || '')
const sortBy = ref(route.query.sort as string || 'bump')
const sortOrder = ref(route.query.order as string || 'desc')
const filterYear = ref(route.query.year as string || '')
const filterMonth = ref(route.query.month as string || '')
const currentPage = ref(parseInt(route.query.page as string) || 1)
const showSortMenu = ref(false)
const showYearMenu = ref(false)
const showMonthMenu = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)
const yearMenuRef = ref<HTMLElement | null>(null)
const monthMenuRef = ref<HTMLElement | null>(null)

// 高级筛选
const showAdvancedFilter = ref(false)
const selectedTagIds = ref<number[]>(
  (route.query.tagIds as string)?.split(',').map(Number).filter(n => !isNaN(n)) || []
)
const filterRatingMin = ref(route.query.ratingMin as string || '')
const filterResourceTypeId = ref(route.query.resourceTypeId as string || '')
const filterHasResource = ref(route.query.hasResource as string || '')
const filterHasMachineTranslation = ref(route.query.hasMachineTranslation as string || '')
const filterCompanyId = ref(route.query.companyId as string || '')

// 标签与资源类型数据
const { data: rawTagsData } = await useFetch<ListResponse<TagItem>>('/api/tags', { key: 'games-filter-tags', query: { limit: 100 } })
const tagsData = computed(() => rawTagsData.value?.items || [])
const { data: resourceTypes } = await useFetch<ResourceTypeItem[]>('/api/resource-types', { key: 'games-filter-resource-types' })

// 会社搜索筛选
const companySearchQuery = ref('')
const showCompanyDropdown = ref(false)
const filterCompanyResults = ref<CompanyItem[]>([])
const selectedCompany = ref<{ id: number; name: string } | null>(null)
const companyDropdownRef = ref<HTMLElement | null>(null)
let companyFilterTimer: ReturnType<typeof setTimeout>

onMounted(() => {
  if (filterCompanyId.value) {
    $fetch<CompanyItem>(`/api/companies/${filterCompanyId.value}`).then(data => {
      if (data) selectedCompany.value = { id: data.id, name: data.name }
    }).catch(() => {})
  }
})

function searchFilterCompanies() {
  clearTimeout(companyFilterTimer)
  const q = companySearchQuery.value.trim()
  if (!q) {
    filterCompanyResults.value = []
    return
  }
  companyFilterTimer = setTimeout(async () => {
    try {
      const data = await $fetch<ListResponse<CompanyItem>>('/api/companies', { query: { search: q, limit: 10 } })
      filterCompanyResults.value = data.items || []
    } catch {
      filterCompanyResults.value = []
    }
  }, 300)
}

function selectCompanyFilter(company: { id: number; name: string }) {
  selectedCompany.value = company
  filterCompanyId.value = String(company.id)
  companySearchQuery.value = ''
  filterCompanyResults.value = []
  showCompanyDropdown.value = false
}

function clearCompanyFilter() {
  selectedCompany.value = null
  filterCompanyId.value = ''
}

onClickOutside(companyDropdownRef, () => {
  showCompanyDropdown.value = false
})

const hasActiveFilters = computed(() => {
  return selectedTagIds.value.length > 0 || filterRatingMin.value || filterResourceTypeId.value || filterHasResource.value || filterHasMachineTranslation.value || filterCompanyId.value
})

function toggleTagFilter(tagId: number) {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx >= 0) {
    selectedTagIds.value.splice(idx, 1)
  } else {
    selectedTagIds.value.push(tagId)
  }
}

function clearAdvancedFilters() {
  selectedTagIds.value = []
  filterRatingMin.value = ''
  filterResourceTypeId.value = ''
  filterHasResource.value = ''
  filterHasMachineTranslation.value = ''
  clearCompanyFilter()
  currentPage.value = 1
  updateUrl()
}

function applyAdvancedFilters() {
  currentPage.value = 1
  updateUrl()
}

// 年份选项 (初始值为 0，在 onMounted 中赋值以避免 SSR/CSR 时区差导致水合失配)
const currentYear = ref(0)
const yearOptions = computed(() => {
  if (!currentYear.value) return []
  return Array.from({ length: 25 }, (_, i) => (currentYear.value - i).toString())
})
onMounted(() => { currentYear.value = new Date().getFullYear() })

// 排序选项
const sortOptions = [
  { value: 'bump', label: '按热度', icon: 'fa-solid fa-fire' },
  { value: 'latest', label: '最新创建', icon: 'fa-solid fa-clock' },
  { value: 'updated', label: '最近更新', icon: 'fa-solid fa-rotate' },
  { value: 'popular', label: '最多浏览', icon: 'fa-solid fa-eye' },
  { value: 'rating', label: '评分最高', icon: 'fa-solid fa-star' },
  { value: 'release', label: '发售日期', icon: 'fa-solid fa-calendar' },
]

// 点击外部关闭菜单
onClickOutside(sortMenuRef, () => {
  showSortMenu.value = false
})
onClickOutside(yearMenuRef, () => {
  showYearMenu.value = false
})
onClickOutside(monthMenuRef, () => {
  showMonthMenu.value = false
})

function selectSort(value: string) {
  sortBy.value = value
  showSortMenu.value = false
  handleSort()
}

function selectYear(value: string) {
  filterYear.value = value
  showYearMenu.value = false
  currentPage.value = 1
  updateUrl()
}

function selectMonth(value: string) {
  filterMonth.value = value
  showMonthMenu.value = false
  currentPage.value = 1
  updateUrl()
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  currentPage.value = 1
  updateUrl()
}

// 获取数据（需要带 auth token 以正确过滤 NSFW 内容）
const { data: gamesData, refresh } = await useAuthFetch<ListResponse<GameCardItem>>('/api/games', {
  key: 'games-list',
  query: computed(() => ({
    page: currentPage.value,
    limit: 24,
    search: searchQuery.value || undefined,
    sort: sortBy.value,
    order: sortOrder.value,
    year: filterYear.value || undefined,
    month: filterMonth.value || undefined,
    tagIds: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined,
    ratingMin: filterRatingMin.value || undefined,
    resourceTypeId: filterResourceTypeId.value || undefined,
    hasResource: filterHasResource.value || undefined,
    hasMachineTranslation: filterHasMachineTranslation.value || undefined,
    companyId: filterCompanyId.value || undefined,
  })),
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
      ...(sortBy.value !== 'bump' && { sort: sortBy.value }),
      ...(sortOrder.value !== 'desc' && { order: sortOrder.value }),
      ...(filterYear.value && { year: filterYear.value }),
      ...(filterMonth.value && { month: filterMonth.value }),
      ...(currentPage.value > 1 && { page: currentPage.value }),
      ...(selectedTagIds.value.length > 0 && { tagIds: selectedTagIds.value.join(',') }),
      ...(filterRatingMin.value && { ratingMin: filterRatingMin.value }),
      ...(filterResourceTypeId.value && { resourceTypeId: filterResourceTypeId.value }),
      ...(filterHasResource.value && { hasResource: filterHasResource.value }),
      ...(filterHasMachineTranslation.value && { hasMachineTranslation: filterHasMachineTranslation.value }),
      ...(filterCompanyId.value && { companyId: filterCompanyId.value }),
    },
  })
}

const siteName = useSiteName()
// SEO
useHead({
  title: computed(() => `游戏列表 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} Galgame 数据库，支持按年份、标签、会社多维度筛选。`
    const title = `游戏列表 - ${siteName.value}`
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

/* 滑动展开动画 */
.slide-enter-active {
  animation: slide-down 0.25s ease-out;
}
.slide-leave-active {
  animation: slide-up 0.2s ease-in forwards;
}
@keyframes slide-down {
  from { opacity: 0; max-height: 0; transform: translateY(-10px); }
  to { opacity: 1; max-height: 500px; transform: translateY(0); }
}
@keyframes slide-up {
  from { opacity: 1; max-height: 500px; transform: translateY(0); }
  to { opacity: 0; max-height: 0; transform: translateY(-10px); }
}
</style>

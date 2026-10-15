<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    
    <!-- 页面标题 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
      <div>
        <h1 class="text-2xl font-bold">文档中心</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          帮助文档、使用指南与公告信息
        </p>
      </div>
    </div>

    <!-- 分类卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-12">
      <div 
        v-for="category in categories" 
        :key="category.name"
        class="group bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden hover:shadow-lg transition-shadow"
      >
        <!-- 分类头部 -->
        <div 
          class="h-24 relative overflow-hidden flex items-center justify-center"
          :style="{ backgroundColor: getCategoryColor(category.name) }"
        >
          <FaIcon :icon="getCategoryIcon(category.name)" class="text-white/30 text-5xl" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <FaIcon :icon="getCategoryIcon(category.name)" class="text-sm" />
              {{ getCategoryDisplayName(category.name) }}
            </h2>
            <p class="text-white/70 text-xs">{{ category.posts.length }} 篇文档</p>
          </div>
        </div>
        
        <!-- 文档列表 -->
        <div class="p-4 space-y-2">
          <NuxtLink 
            v-for="post in category.posts.slice(0, 5)" 
            :key="post._path"
            :to="post._path"
            class="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition group/item"
          >
            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <Icon name="fa6-solid:file-lines" class="text-gray-400 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium truncate group-hover/item:text-gray-900 dark:group-hover/item:text-white">
                {{ post.title }}
              </h3>
              <p v-if="post.date" class="text-xs text-gray-400">{{ formatDate(post.date) }}</p>
            </div>
            <Icon name="fa6-solid:chevron-right" class="text-gray-300 dark:text-zinc-600 text-xs group-hover/item:text-gray-500 transition" />
          </NuxtLink>
          
          <NuxtLink 
            v-if="category.posts.length > 5"
            :to="`/posts?category=${category.name}`"
            class="block text-center py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            查看全部 {{ category.posts.length }} 篇 →
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- 最新文档 -->
    <div class="mb-12">
      <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
        <Icon name="fa6-solid:clock" class="text-gray-400" />
        最新文档
      </h2>
      <div class="space-y-4">
        <NuxtLink 
          v-for="post in recentPosts" 
          :key="post._path"
          :to="post._path"
          class="block bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-5 shadow hover:shadow-lg transition-shadow group"
        >
          <div class="flex gap-3 sm:gap-5">
            <!-- Banner 缩略图 -->
            <div 
              class="w-24 sm:w-32 h-20 rounded-lg flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-zinc-700 flex items-center justify-center"
            >
              <img 
                v-if="post.banner" 
                :src="post.banner" 
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <Icon name="fa6-solid:file-lines" class="text-gray-300 dark:text-zinc-500 text-2xl" v-else />
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span 
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  :style="{ backgroundColor: getCategoryColor(getCategoryFromPath(post._path)) + '20', color: getCategoryColor(getCategoryFromPath(post._path)) }"
                >
                  {{ getCategoryDisplayName(getCategoryFromPath(post._path)) }}
                </span>
                <span v-if="post.date" class="text-xs text-gray-400">{{ formatDate(post.date) }}</span>
              </div>
              <h3 class="font-semibold text-base mb-1 group-hover:text-gray-900 dark:group-hover:text-white transition">
                {{ post.title }}
              </h3>
              <p v-if="post.description" class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                {{ post.description }}
              </p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <div v-if="!categories.length" class="text-center text-gray-500 py-16">
      <Icon name="fa6-solid:file-lines" class="text-4xl mb-4" />
      <p>暂无文档</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-ignore - queryContent 是 Nuxt 自动导入的
const queryContent = (globalThis as any).queryContent

const { formatDate } = useFormatDate()

// 获取所有文章
const { data: posts } = await useAsyncData('posts', () =>
  (queryContent as any)('/posts').find()
)

// 分类颜色映射（统一灰色）
const categoryColors: Record<string, string> = {
  'guide': '#6b7280',
  'tutorial': '#6b7280',
  'news': '#6b7280',
  'faq': '#6b7280',
  'changelog': '#6b7280',
  'default': '#6b7280',
}

// 分类图标映射
const categoryIcons: Record<string, string> = {
  'guide': 'fa-solid fa-book',
  'tutorial': 'fa-solid fa-graduation-cap',
  'news': 'fa-solid fa-newspaper',
  'faq': 'fa-solid fa-circle-question',
  'changelog': 'fa-solid fa-clock-rotate-left',
  'default': 'fa-solid fa-folder',
}

// 分类显示名称
const categoryDisplayNames: Record<string, string> = {
  'guide': '使用指南',
  'tutorial': '新手教程',
  'news': '公告通知',
  'faq': '常见问题',
  'changelog': '更新日志',
}

function getCategoryColor(category: string): string {
  return categoryColors[category.toLowerCase()] || categoryColors.default
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category.toLowerCase()] || categoryIcons.default
}

function getCategoryDisplayName(category: string): string {
  return categoryDisplayNames[category.toLowerCase()] || category
}

function getCategoryFromPath(path?: string): string {
  const parts = path?.split('/').filter(Boolean) || []
  return parts.length > 1 ? parts[1] : '未分类'
}

// 按分类分组
const categories = computed(() => {
  if (!posts.value) return []

  const grouped: Record<string, any[]> = {}

  for (const post of posts.value as any[]) {
    const category = getCategoryFromPath(post._path)
    
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(post)
  }

  // 排序
  return Object.entries(grouped).map(([name, posts]) => ({
    name,
    posts: posts.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    }),
  }))
})

// 最新文档
const recentPosts = computed(() => {
  if (!posts.value) return []
  return [...(posts.value as any[])]
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })
    .slice(0, 5)
})

const siteName = useSiteName()
useHead({
  title: computed(() => `文档中心 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 帮助文档、使用指南与站点公告。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `文档中心 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `文档中心 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

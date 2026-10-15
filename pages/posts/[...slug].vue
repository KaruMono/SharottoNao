<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_200px] gap-6 lg:gap-8">
      
      <!-- 左侧：文档列表 -->
      <aside class="hidden lg:block">
        <div class="sticky top-28 bg-white dark:bg-zinc-800 rounded-xl shadow p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Icon name="fa6-solid:book" />文档目录
          </h3>
          <nav class="space-y-1">
            <template v-for="category in categories" :key="category.name">
              <!-- 文件夹 -->
              <div>
                <button 
                  @click="toggleCategory(category.name)"
                  class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                >
                  <FaIcon
                    :icon="expandedCategories.includes(category.name) ? 'fa6-solid:folder-open' : 'fa6-solid:folder'"
                    class="text-gray-400 w-4 transition-transform duration-200"
                    :style="{ transform: expandedCategories.includes(category.name) ? 'scale(1.1)' : 'scale(1)' }"
                  />
                  <span class="flex-1 text-left truncate">{{ category.name }}</span>
                  <Icon name="fa6-solid:chevron-right" class="text-xs text-gray-400 transition-transform duration-200" :style="{ transform: expandedCategories.includes(category.name) ? 'rotate(90deg)' : 'rotate(0)' }" />
                </button>
                <!-- 文档列表（带动画） -->
                <Transition name="folder">
                  <div v-if="expandedCategories.includes(category.name)" class="ml-4 mt-1 space-y-0.5 overflow-hidden">
                    <NuxtLink 
                      v-for="(post, idx) in category.posts"
                      :key="post._path"
                      :to="post._path"
                      class="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                      :class="{ 'bg-gray-100 dark:bg-zinc-700 font-medium': route.path === post._path }"
                      :style="{ animationDelay: `${idx * 30}ms` }"
                    >
                      <Icon name="fa6-solid:file-lines" class="text-gray-400 w-4" />
                      <span class="truncate">{{ post.title }}</span>
                    </NuxtLink>
                  </div>
                </Transition>
              </div>
            </template>
          </nav>
        </div>
      </aside>

      <!-- 中间：文章内容 -->
      <main>
        <ContentDoc v-slot="{ doc }">
          <!-- 文章头部 -->
          <div class="mb-6 md:mb-8">
            <img 
              v-if="doc.banner"
              :src="doc.banner" 
              :alt="doc.title"
              class="w-full h-64 object-cover rounded-xl mb-6"
            />
            <div class="flex items-center justify-between gap-3">
              <h1 class="text-2xl md:text-3xl font-bold">{{ doc.title }}</h1>
              <button 
                v-if="toc.length"
                @click="showMobileToc = !showMobileToc"
                class="lg:hidden shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                title="页面索引"
              >
                <Icon name="fa6-solid:list" class="text-sm text-gray-500" />
              </button>
            </div>
            <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
              <span v-if="doc.date">
                <Icon name="fa6-solid:calendar" class="mr-1.5" />{{ formatDate(doc.date) }}
              </span>
              <span v-if="author">
                <Icon name="fa6-solid:user" class="mr-1.5" />{{ author }}
              </span>
            </div>
            <p v-if="doc.description" class="text-gray-600 dark:text-gray-400 mt-4">
              {{ doc.description }}
            </p>
          </div>

          <!-- 文章内容 -->
          <div ref="contentRef" class="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-6 md:p-8 shadow prose dark:prose-invert max-w-none">
            <ContentRenderer :value="doc" />
          </div>

          <!-- 移动端页面索引 -->
          <Transition name="bottom-sheet">
            <div 
              v-if="showMobileToc"
              class="fixed inset-0 z-[80] lg:hidden flex items-end justify-center bg-black/50"
              @click.self="showMobileToc = false"
            >
              <div class="bg-white dark:bg-zinc-800 rounded-t-2xl shadow-2xl w-full max-h-[60vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
                <div class="flex items-center justify-between px-5 py-4 border-b dark:border-zinc-700">
                  <h3 class="font-semibold text-sm flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Icon name="fa6-solid:list" />页面索引
                  </h3>
                  <button @click="showMobileToc = false" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                    <Icon name="fa6-solid:xmark" class="text-gray-400" />
                  </button>
                </div>
                <nav class="p-4 space-y-1 overflow-y-auto max-h-[calc(60vh-60px)]">
                  <a 
                    v-for="heading in toc"
                    :key="heading.id"
                    :href="`#${heading.id}`"
                    class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                    :class="[
                      heading.level === 2 ? 'ml-3' : '',
                      heading.level === 3 ? 'ml-6 text-xs' : '',
                      activeHeading === heading.id ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'
                    ]"
                    @click.prevent="scrollToHeading(heading.id); showMobileToc = false"
                  >
                    <span 
                      class="w-5 h-5 flex items-center justify-center rounded text-xs font-medium shrink-0"
                      :class="activeHeading === heading.id ? 'bg-gray-800 dark:bg-zinc-500 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-400'"
                    >
                      H{{ heading.level }}
                    </span>
                    <span class="truncate">{{ heading.text }}</span>
                  </a>
                </nav>
              </div>
            </div>
          </Transition>

          <!-- 返回按钮 -->
          <div class="mt-8 lg:hidden">
            <NuxtLink 
              to="/posts"
              class="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Icon name="fa6-solid:arrow-left" />返回文档列表
            </NuxtLink>
          </div>
        </ContentDoc>
      </main>

      <!-- 右侧：页面索引 -->
      <aside class="hidden lg:block">
        <div class="sticky top-28 bg-white dark:bg-zinc-800 rounded-xl shadow p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Icon name="fa6-solid:list" />页面索引
          </h3>
          <nav class="space-y-1">
            <a 
              v-for="heading in toc"
              :key="heading.id"
              :href="`#${heading.id}`"
              class="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              :class="[
                heading.level === 2 ? 'ml-3' : '',
                heading.level === 3 ? 'ml-6 text-xs' : '',
                activeHeading === heading.id ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400'
              ]"
              @click.prevent="scrollToHeading(heading.id)"
            >
              <span 
                class="w-5 h-5 flex items-center justify-center rounded text-xs font-medium"
                :class="activeHeading === heading.id ? 'bg-gray-800 dark:bg-zinc-500 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-400'"
              >
                H{{ heading.level }}
              </span>
              <span class="truncate">{{ heading.text }}</span>
            </a>
            <div v-if="!toc.length" class="text-sm text-gray-400 px-2">暂无索引</div>
          </nav>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-ignore - queryContent 是 Nuxt 自动导入的
const queryContent = (globalThis as any).queryContent

const route = useRoute()
const { formatDate } = useFormatDate()

// 获取文章
const { data: doc } = await useAsyncData('post-' + route.path, () =>
  (queryContent as any)(route.path).findOne()
)

// 获取所有文章（用于左侧导航）
const { data: posts } = await useAsyncData('all-posts', () =>
  (queryContent as any)('/posts').find()
)

// 按分类分组
const categories = computed(() => {
  if (!posts.value) return []

  const grouped: Record<string, any[]> = {}

  for (const post of posts.value as any[]) {
    const pathParts = post._path?.split('/').filter(Boolean) || []
    const category = pathParts.length > 1 ? pathParts[1] : '未分类'
    
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(post)
  }

  return Object.entries(grouped).map(([name, posts]) => ({
    name,
    posts: posts.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    }),
  }))
})

// 展开的分类
const expandedCategories = ref<string[]>([])

// 初始化展开当前文章所在的分类
onMounted(() => {
  const pathParts = route.path.split('/').filter(Boolean)
  if (pathParts.length > 1) {
    const currentCategory = pathParts[1]
    if (!expandedCategories.value.includes(currentCategory)) {
      expandedCategories.value.push(currentCategory)
    }
  }
})

function toggleCategory(name: string) {
  const index = expandedCategories.value.indexOf(name)
  if (index > -1) {
    expandedCategories.value.splice(index, 1)
  } else {
    expandedCategories.value.push(name)
  }
}

// 获取作者信息
const author = ref<string | null>(null)
if ((doc.value as any)?.userId) {
  try {
    // 可以从API获取用户信息
    // const userData = await $fetch(`/api/users/${doc.value.userId}`)
    // author.value = userData.username
  } catch {
    // 忽略错误
  }
}

// 页面索引（TOC）
interface Heading {
  id: string
  text: string
  level: number
}

const contentRef = ref<HTMLElement>()
const toc = ref<Heading[]>([])
const activeHeading = ref('')
const showMobileToc = ref(false)

// 提取标题
function extractHeadings() {
  if (!contentRef.value) return
  
  const headings = contentRef.value.querySelectorAll('h1, h2, h3')
  toc.value = Array.from(headings).map((heading, index) => {
    // 确保有 id
    if (!heading.id) {
      heading.id = `heading-${index}`
    }
    return {
      id: heading.id,
      text: heading.textContent || '',
      level: parseInt(heading.tagName[1]),
    }
  })
}

// 滚动到标题
function scrollToHeading(id: string) {
  const element = document.getElementById(id)
  if (element) {
    const offset = 100 // 顶栏高度
    const top = element.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
    activeHeading.value = id
  }
}

// 监听滚动更新当前标题
function updateActiveHeading() {
  const headings = toc.value
  if (!headings.length) return
  
  const offset = 120
  let current = ''
  
  for (const heading of headings) {
    const element = document.getElementById(heading.id)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= offset) {
        current = heading.id
      }
    }
  }
  
  activeHeading.value = current
}

// 用 requestAnimationFrame 节流滚动处理，避免每次滚动都触发布局计算
let ticking = false
function handleScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    updateActiveHeading()
    ticking = false
  })
}

onMounted(() => {
  // 延迟提取标题，等待内容渲染
  setTimeout(extractHeadings, 100)

  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

const siteName = useSiteName()
// SEO
useHead({
  title: computed(() => (doc.value as any)?.title ? `${(doc.value as any).title} - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    const currentDoc = doc.value as any
    const title = currentDoc?.title ? `${currentDoc.title} - ${siteName.value}` : siteName.value
    const desc = currentDoc?.description || ''
    const hasBanner = !!currentDoc?.banner
    const metas: any[] = [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: hasBanner ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
    if (hasBanner) {
      metas.push({ property: 'og:image', content: currentDoc?.banner })
      metas.push({ name: 'twitter:image', content: currentDoc?.banner })
    }
    if (currentDoc?.date) {
      metas.push({ property: 'article:published_time', content: new Date(currentDoc.date).toISOString() })
    }
    return metas
  }),
})
</script>

<style>
/* Prose 样式 */
.prose {
  @apply text-gray-700 dark:text-gray-300;
}

.prose h1, .prose h2, .prose h3, .prose h4 {
  @apply text-gray-900 dark:text-gray-100 font-semibold;
}

.prose h2 {
  @apply text-xl mt-8 mb-4 pb-2 border-b dark:border-zinc-700;
}

.prose h3 {
  @apply text-lg mt-6 mb-3;
}

.prose p {
  @apply my-4 leading-relaxed;
}

.prose a {
  @apply text-blue-600 dark:text-blue-400 hover:underline;
}

.prose code {
  @apply bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-sm;
}

.prose pre {
  @apply bg-gray-900 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto;
}

.prose pre code {
  @apply bg-transparent p-0;
}

.prose ul, .prose ol {
  @apply my-4 pl-6;
}

.prose li {
  @apply my-2;
}

.prose blockquote {
  @apply border-l-4 border-gray-300 dark:border-zinc-600 pl-4 italic text-gray-600 dark:text-gray-400;
}

.prose img {
  @apply rounded-lg;
}

.prose table {
  @apply w-full border-collapse;
}

.prose th, .prose td {
  @apply border dark:border-zinc-700 px-4 py-2;
}

.prose th {
  @apply bg-gray-100 dark:bg-zinc-800;
}

/* 底部弹出面板动画 */
.bottom-sheet-enter-active {
  transition: opacity 0.25s ease;
}
.bottom-sheet-enter-active > div {
  animation: sheet-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.bottom-sheet-leave-active {
  transition: opacity 0.2s ease;
}
.bottom-sheet-leave-active > div {
  animation: sheet-slide-down 0.2s ease-in forwards;
}
.bottom-sheet-enter-from,
.bottom-sheet-leave-to {
  opacity: 0;
}
@keyframes sheet-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
@keyframes sheet-slide-down {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

/* 文件夹展开/收起动画 */
.folder-enter-active {
  animation: folder-expand 0.25s ease-out;
}
.folder-leave-active {
  animation: folder-collapse 0.2s ease-in forwards;
}
@keyframes folder-expand {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}
@keyframes folder-collapse {
  from {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
}

/* 文档列表项动画 */
.folder-enter-active a {
  animation: item-appear 0.2s ease-out forwards;
  opacity: 0;
}
@keyframes item-appear {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

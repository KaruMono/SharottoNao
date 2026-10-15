<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div class="mb-5 md:mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl md:text-3xl font-bold tracking-tight">工具箱</h1>
          <span class="rounded-full bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-gray-500 shadow-sm border border-gray-200 dark:border-zinc-700">
            {{ displayTools.length }} / {{ allTools?.length || 0 }}
          </span>
        </div>
        <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">整理常用运行环境、补丁工具与资源站辅助软件。</p>
      </div>

      <div class="relative w-full lg:w-80">
        <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="搜索工具、作者或简介..."
          class="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-gray-400 dark:focus:border-zinc-500"
        />
      </div>
    </div>

    <!-- 移动端分类 -->
    <div ref="mobileCategoryScroller" class="mobile-category-scroll lg:hidden -mx-2.5 sm:-mx-4 mb-5 overflow-x-auto px-2.5 sm:px-4 pb-1">
      <div class="flex w-max gap-2">
        <button
          @click="selectedCategory = ''"
          class="mobile-category-pill"
          :class="{ active: selectedCategory === '' }"
          :data-active="selectedCategory === '' ? 'true' : undefined"
        >
          <Icon name="fa6-solid:layer-group" />
          <span>全部</span>
          <span class="text-xs opacity-60">{{ allTools?.length || 0 }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          @click="selectedCategory = cat.slug"
          class="mobile-category-pill"
          :class="{ active: selectedCategory === cat.slug }"
          :data-active="selectedCategory === cat.slug ? 'true' : undefined"
        >
          <FaIcon :icon="cat.icon || 'fa6-solid:folder'" />
          <span>{{ cat.name }}</span>
          <span class="text-xs opacity-60">{{ cat._count?.tools ?? 0 }}</span>
        </button>
      </div>
    </div>

    <div class="grid gap-4 lg:gap-6 lg:grid-cols-[260px_1fr]">
      <!-- 分类导航 -->
      <aside class="hidden lg:block lg:sticky lg:top-28 lg:self-start">
        <div class="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <h3 class="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Icon name="fa6-solid:toolbox" />工具分类
          </h3>
          <nav class="space-y-1">
            <button
              @click="selectedCategory = ''"
              class="tool-category-btn"
              :class="{ active: selectedCategory === '' }"
            >
              <Icon name="fa6-solid:folder-open" />
              <span class="flex-1 truncate text-left">全部工具</span>
              <span class="text-xs text-gray-400">{{ allTools?.length || 0 }}</span>
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              @click="selectedCategory = cat.slug"
              class="tool-category-btn"
              :class="{ active: selectedCategory === cat.slug }"
            >
              <FaIcon :icon="cat.icon || 'fa6-solid:folder'" />
              <span class="flex-1 truncate text-left">{{ cat.name }}</span>
              <span class="text-xs text-gray-400">{{ cat._count?.tools ?? 0 }}</span>
            </button>
          </nav>
        </div>
      </aside>

      <!-- 工具列表 -->
      <Transition name="fade" mode="out-in">
        <div
          v-if="displayTools.length"
          :key="selectedCategory + searchQuery + '-grid'"
          class="grid grid-cols-1 xl:grid-cols-2 gap-4"
        >
          <article
            v-for="tool in displayTools"
            :key="tool.id"
            class="group bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition overflow-hidden"
          >
            <div class="p-3.5 sm:p-4 flex gap-3 sm:gap-4">
              <div class="shrink-0">
                <img
                  v-if="tool.icon"
                  :src="tool.icon"
                  :alt="tool.name"
                  class="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover border border-gray-100 dark:border-zinc-700"
                />
                <div v-else class="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gray-100 dark:bg-zinc-700 flex items-center justify-center">
                  <Icon name="fa6-solid:wrench" class="text-lg text-gray-400 dark:text-gray-500" />
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h2 class="font-semibold text-gray-950 dark:text-white line-clamp-1">{{ tool.name }}</h2>
                    <div class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-400">
                      <span v-if="tool.version">v{{ tool.version }}</span>
                      <span v-if="tool.author" class="truncate">
                        <Icon name="fa6-solid:user" class="mr-1" />{{ tool.author }}
                      </span>
                      <span v-if="tool.category" class="inline-flex items-center gap-1">
                        <FaIcon v-if="tool.category.icon" :icon="tool.category.icon" />{{ tool.category.name }}
                      </span>
                    </div>
                  </div>
                </div>

                <p v-if="tool.description" class="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-6">
                  {{ tool.description }}
                </p>
                <p v-else class="mt-3 text-sm text-gray-400 italic">暂无简介</p>
              </div>
            </div>

            <div class="px-3.5 sm:px-4 py-3 border-t border-gray-100 dark:border-zinc-700 bg-gray-50/70 dark:bg-zinc-900/30 flex items-center justify-between gap-3">
              <a
                v-if="tool.githubUrl"
                :href="tool.githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition"
              >
                <Icon name="fa6-brands:github" />GitHub
              </a>
              <span v-else class="text-xs text-gray-400">外部下载</span>
              <NuxtLink
                :to="`/tool-download/${tool.id}`"
                class="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-gray-700 dark:hover:bg-white transition"
              >
                <Icon name="fa6-solid:download" />下载
              </NuxtLink>
            </div>
          </article>
        </div>

        <div v-else key="empty" class="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm text-center text-gray-500 dark:text-gray-400 py-20">
          <Icon name="fa6-solid:box-open" class="text-4xl mb-4 text-gray-300 dark:text-zinc-600" />
          <p class="font-medium">没有找到工具</p>
          <p class="mt-1 text-sm">换个分类或搜索词试试看。</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: categories } = await (useFetch as any)('/api/tools/categories', { key: 'tools-categories' })
const { data: allTools } = await (useFetch as any)('/api/tools', { key: 'tools-list' })

const selectedCategory = ref('')
const searchQuery = ref('')
const mobileCategoryScroller = ref<HTMLElement | null>(null)

function scrollActiveMobileCategoryIntoView(behavior: ScrollBehavior = 'smooth') {
  const active = mobileCategoryScroller.value?.querySelector('[data-active="true"]') as HTMLElement | null
  active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior })
}

// UA-based auto-selection on client
onMounted(() => {
  if (categories.value?.length) {
    const ua = navigator.userAgent
    const slugs = categories.value.map((c: any) => c.slug)
    if (/iPhone|iPad|iPod/i.test(ua) && slugs.includes('ios')) {
      selectedCategory.value = 'ios'
    } else if (/Android/i.test(ua) && slugs.includes('android')) {
      selectedCategory.value = 'android'
    } else if (slugs.includes('windows')) {
      selectedCategory.value = 'windows'
    }
  }
  nextTick(() => scrollActiveMobileCategoryIntoView('auto'))
})

watch(selectedCategory, () => {
  nextTick(() => scrollActiveMobileCategoryIntoView())
})

const displayTools = computed(() => {
  if (!allTools.value) return []
  const keyword = searchQuery.value.trim().toLowerCase()
  return allTools.value.filter((tool: any) => {
    const categoryMatched = !selectedCategory.value || tool.category?.slug === selectedCategory.value
    if (!categoryMatched) return false
    if (!keyword) return true
    return [
      tool.name,
      tool.version,
      tool.author,
      tool.description,
      tool.category?.name,
    ].filter(Boolean).some((value: string) => value.toLowerCase().includes(keyword))
  })
})

const siteName = useSiteName()
useHead({
  title: computed(() => `工具箱 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 整理 Galgame 常用运行环境、补丁、翻译与辅助工具。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `工具箱 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `工具箱 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

<style scoped>
.mobile-category-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  border: 1px solid rgb(229, 231, 235);
  background: white;
  padding: 0 0.875rem;
  color: rgb(75, 85, 99);
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.mobile-category-scroll {
  scrollbar-width: none;
}

.mobile-category-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-category-pill i {
  color: rgb(156, 163, 175);
}

.mobile-category-pill.active {
  border-color: rgb(17, 24, 39);
  background: rgb(17, 24, 39);
  color: white;
}

.mobile-category-pill.active i {
  color: white;
}

.dark .mobile-category-pill {
  border-color: rgb(63, 63, 70);
  background: rgb(39, 39, 42);
  color: rgb(212, 212, 216);
}

.dark .mobile-category-pill.active {
  border-color: rgb(244, 244, 245);
  background: rgb(244, 244, 245);
  color: rgb(24, 24, 27);
}

.dark .mobile-category-pill.active i {
  color: rgb(24, 24, 27);
}

.tool-category-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem;
  color: rgb(75, 85, 99);
  font-size: 0.875rem;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.tool-category-btn i {
  width: 1rem;
  text-align: center;
  color: rgb(156, 163, 175);
}

.tool-category-btn:hover {
  background: rgb(243, 244, 246);
  color: rgb(17, 24, 39);
}

.tool-category-btn.active {
  background: rgb(243, 244, 246);
  color: rgb(17, 24, 39);
  font-weight: 500;
}

.tool-category-btn.active i {
  color: rgb(156, 163, 175);
}

.dark .tool-category-btn {
  color: rgb(212, 212, 216);
}

.dark .tool-category-btn:hover {
  background: rgb(63, 63, 70);
  color: white;
}

.dark .tool-category-btn.active {
  background: rgb(63, 63, 70);
  color: white;
}

.dark .tool-category-btn.active i {
  color: rgb(156, 163, 175);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>

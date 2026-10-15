<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6 py-6">
    <div v-if="series" class="space-y-6">
      <!-- 系列信息 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- 封面 -->
          <div v-if="series.coverImage" class="w-full md:w-48 flex-shrink-0">
            <img 
              :src="series.coverImage" 
              :alt="series.name"
              class="w-full rounded-lg shadow"
            />
          </div>
          
          <!-- 信息 -->
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-3">
              <h1 class="text-2xl font-bold">{{ series.name }}</h1>
              <span v-if="series.isNsfw" class="px-2 py-0.5 bg-red-500 text-white text-xs rounded font-medium">NSFW</span>
            </div>
            
            <p v-if="series.nameOriginal" class="text-gray-500 dark:text-gray-400 mb-4">
              {{ series.nameOriginal }}
            </p>
            
            <div v-if="series.description" class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {{ series.description }}
            </div>
            
            <div class="mt-4 text-sm text-gray-500">
              共 {{ series.gamesCount ?? series._count?.games ?? 0 }} 个游戏
            </div>
          </div>
        </div>
      </div>

      <!-- 系列内的游戏 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
        <h2 class="font-semibold text-lg mb-4">系列游戏</h2>
        
        <div v-if="series.games?.length" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          <GameCard 
            v-for="game in series.games" 
            :key="game.id"
            :game="game"
          />
        </div>
        
        <div v-else class="text-center py-12 text-gray-500">
          <Icon name="fa6-solid:layer-group" class="text-3xl mb-3" />
          <p>暂无游戏</p>
        </div>
      </div>
    </div>
    
    <div v-else-if="error" class="text-center py-12">
      <Icon name="fa6-solid:circle-exclamation" class="text-4xl text-red-500 mb-4" />
      <p class="text-gray-500">{{ error.message || '系列不存在' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SeriesItem } from '~/types/api'

const route = useRoute()
const siteName = useSiteName()
const runtimeConfig = useRuntimeConfig()

const seriesId = computed(() => parseInt(route.params.id as string))

// 获取系列数据
const { data: series, error } = await useAuthFetch<SeriesItem>(`/api/series/${seriesId.value}`, {
  key: `series-${seriesId.value}`,
})

useHead({
  title: computed(() => series.value ? `${series.value.name} 系列 - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    if (!series.value) return []
    const count = series.value.gamesCount ?? series.value._count?.games ?? 0
    const desc = series.value.description?.slice(0, 150)
      || `${series.value.name} 系列，共 ${count} 部 Galgame 作品。`
    const title = `${series.value.name} 系列 - ${siteName.value}`
    const hasCover = !!series.value.coverImage
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      ...(hasCover ? [
        { property: 'og:image', content: series.value.coverImage },
        { name: 'twitter:image', content: series.value.coverImage },
      ] : []),
      { name: 'twitter:card', content: hasCover ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
  }),
  script: computed(() => {
    if (!series.value) return []
    const siteUrl = (runtimeConfig.public?.siteUrl as string || '').replace(/\/+$/, '')
    return [{
      type: 'application/ld+json',
      key: 'jsonld-breadcrumb',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: '游戏系列', item: `${siteUrl}/series` },
          { '@type': 'ListItem', position: 3, name: `${series.value.name} 系列`, item: `${siteUrl}/series/${series.value.id}` },
        ],
      }),
    }]
  }),
})
</script>

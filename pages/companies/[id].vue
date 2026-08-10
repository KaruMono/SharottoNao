<template>
  <div class="max-w-6xl mx-auto px-2.5 sm:px-4 md:px-6">
    <div v-if="company">
      <!-- 会社信息头部 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-8">
        <div class="flex items-start gap-6">
          <div class="w-24 h-24 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
            <img v-if="company.logo" :src="company.logo" class="w-full h-full object-cover" />
            <i v-else class="fa-solid fa-building text-3xl text-gray-400"></i>
          </div>
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{{ company.name }}</h1>
            <p v-if="company.nameOriginal" class="text-gray-500 dark:text-gray-400 mt-1">
              {{ company.nameOriginal }}
            </p>
            
            <!-- 别名 -->
            <div v-if="company.aliases?.length" class="flex flex-wrap gap-2 mt-2">
              <span 
                v-for="alias in company.aliases" 
                :key="alias"
                class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-zinc-700 rounded text-gray-600 dark:text-gray-300"
              >
                {{ alias }}
              </span>
            </div>
            
            <div class="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-300">
              <span v-if="company.foundedYear">
                <i class="fa-solid fa-calendar mr-1.5 text-gray-400"></i>{{ company.foundedYear }}年成立
              </span>
              <span>
                <i class="fa-solid fa-gamepad mr-1.5 text-gray-400"></i>{{ company.gamesCount }} 部作品
              </span>
              <a 
                v-if="company.website" 
                :href="company.website" 
                target="_blank"
                rel="noopener noreferrer"
                class="hover:underline text-blue-500 hover:text-blue-600"
              >
                <i class="fa-solid fa-globe mr-1.5"></i>访问官网
              </a>
            </div>

            <!-- 父子会社关系 -->
            <div class="mt-3 flex flex-wrap gap-3 text-sm">
              <div v-if="company.parent" class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <i class="fa-solid fa-sitemap text-gray-400 text-xs"></i>
                <span class="text-gray-400">母会社：</span>
                <NuxtLink :to="`/companies/${company.parent.id}`" class="text-blue-500 hover:underline font-medium flex items-center gap-1.5">
                  <img v-if="company.parent.logo" :src="company.parent.logo" class="w-4 h-4 rounded object-cover" loading="lazy" />
                  {{ company.parent.name }}
                </NuxtLink>
              </div>
              <div v-if="company.children?.length" class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <i class="fa-solid fa-code-branch text-gray-400 text-xs"></i>
                <span class="text-gray-400">子会社：</span>
                <span class="flex flex-wrap gap-2">
                  <NuxtLink
                    v-for="child in company.children"
                    :key="child.id"
                    :to="`/companies/${child.id}`"
                    class="text-blue-500 hover:underline font-medium flex items-center gap-1"
                  >
                    <img v-if="child.logo" :src="child.logo" class="w-4 h-4 rounded object-cover" loading="lazy" />
                    {{ child.name }}
                  </NuxtLink>
                </span>
              </div>
            </div>

            <p v-if="company.description" class="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {{ company.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- 作品列表 -->
      <h2 class="text-xl font-semibold mb-4">作品列表</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        <GameCard 
          v-for="game in company.games" 
          :key="game.id" 
          :game="game" 
        />
      </div>

      <div v-if="!company.games?.length" class="text-center text-gray-500 py-16">
        <i class="fa-solid fa-gamepad text-4xl mb-4"></i>
        <p>暂无作品</p>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else-if="pending" class="text-center py-20">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
    </div>

    <!-- 错误 -->
    <div v-else class="text-center py-20">
      <i class="fa-solid fa-exclamation-circle text-4xl text-gray-400 mb-4"></i>
      <p class="text-gray-500">{{ error?.message || '加载失败' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyItem } from '~/types/api'

const route = useRoute()
const companyId = computed(() => parseInt(route.params.id as string))

const { data: company, pending, error } = await useAuthFetch<CompanyItem>(`/api/companies/${companyId.value}`, {
  key: `company-${companyId.value}`,
})

const siteName = useSiteName()
const runtimeConfig = useRuntimeConfig()
// SEO
useHead({
  title: computed(() => company.value ? `${company.value.name} - ${siteName.value}` : siteName.value),
  meta: computed(() => {
    if (!company.value) return []
    const displayName = company.value.nameOriginal
      ? `${company.value.name}（${company.value.nameOriginal}）`
      : company.value.name
    const desc = company.value.description?.slice(0, 150)
      || `${displayName} 的 Galgame 作品列表，共收录 ${company.value.gamesCount} 部作品。`
    const title = `${company.value.name} - ${siteName.value}`
    const metas: any[] = [
      { name: 'description', content: desc },
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
    const ogImage = company.value.logo || company.value.games?.[0]?.coverImage
    if (ogImage) {
      metas.push({ property: 'og:image', content: ogImage })
      metas.push({ name: 'twitter:image', content: ogImage })
    }
    return metas
  }),
  script: computed(() => {
    if (!company.value) return []
    const siteUrl = (runtimeConfig.public?.siteUrl as string || '').replace(/\/+$/, '')
    const schemas: any[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: '制作会社', item: `${siteUrl}/companies` },
          { '@type': 'ListItem', position: 3, name: company.value.name, item: `${siteUrl}/companies/${company.value.id}` },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: company.value.name,
        url: `${siteUrl}/companies/${company.value.id}`,
        ...(company.value.nameOriginal ? { alternateName: company.value.nameOriginal } : {}),
        ...(company.value.logo ? { logo: company.value.logo } : {}),
        ...(company.value.website ? { sameAs: [company.value.website] } : {}),
        ...(company.value.foundedYear ? { foundingDate: String(company.value.foundedYear) } : {}),
      },
    ]
    return schemas.map((s, i) => ({
      type: 'application/ld+json',
      key: `jsonld-company-${i}`,
      innerHTML: JSON.stringify(s),
    }))
  }),
})
</script>

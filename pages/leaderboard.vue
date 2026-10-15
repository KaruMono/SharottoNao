<template>
  <div class="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6">
    <h1 class="text-2xl font-bold mb-6">贡献排行榜</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <!-- 三列排行 -->
      <div
        v-for="col in columns"
        :key="col.type"
        class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden"
      >
        <!-- 列标题 -->
        <div class="px-4 py-3 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
          <FaIcon :icon="col.icon" class="text-gray-400" />
          <h2 class="font-medium text-sm">{{ col.label }}</h2>
        </div>

        <!-- 列表 -->
        <div v-if="col.data?.items?.length" class="divide-y divide-gray-50 dark:divide-zinc-700/50">
          <div
            v-for="item in col.data.items"
            :key="item.user.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition"
          >
            <!-- 排名 -->
            <div class="w-7 text-center font-bold text-sm flex-shrink-0" :class="rankTextClass(item.rank)">
              <Icon name="fa6-solid:crown" class="text-yellow-500" v-if="item.rank === 1" />
              <Icon name="fa6-solid:medal" class="text-gray-400" v-else-if="item.rank === 2" />
              <Icon name="fa6-solid:medal" class="text-amber-600" v-else-if="item.rank === 3" />
              <span v-else>{{ item.rank }}</span>
            </div>

            <!-- 头像 + 用户名 -->
            <NuxtLink :to="`/user/${item.user.id}`" class="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition">
              <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-600 flex-shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  v-if="item.user.avatar"
                  :src="item.user.avatar"
                  class="w-full h-full object-cover"
                />
                <Icon name="fa6-solid:user" class="text-gray-400 text-xs" v-else />
              </div>
              <span class="text-sm font-medium truncate">{{ item.user.username }}</span>
            </NuxtLink>

            <!-- 分数 + 明细 -->
            <div class="flex-shrink-0 text-right">
              <div class="text-sm font-bold" :class="rankTextClass(item.rank)">{{ item.score }}</div>
              <div class="flex gap-1 mt-0.5 justify-end flex-wrap">
                <span v-if="item.breakdown.resources" class="px-1.5 py-0.5 text-[10px] rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">资源{{ item.breakdown.resources }}</span>
                <span v-if="item.breakdown.createdGames" class="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">创建{{ item.breakdown.createdGames }}</span>
                <span v-if="item.breakdown.editedGames" class="px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">编辑{{ item.breakdown.editedGames }}</span>
                <span v-if="item.breakdown.guides" class="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">攻略{{ item.breakdown.guides }}</span>
                <span v-if="item.breakdown.comments" class="px-1.5 py-0.5 text-[10px] rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">评论{{ item.breakdown.comments }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center text-gray-400 py-12">
          <Icon name="fa6-solid:trophy" class="text-2xl mb-2" />
          <p class="text-sm">暂无数据</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LeaderboardResponse } from '~/types/api'

const { data: editData } = await (useFetch as any)('/api/leaderboard', {
  key: 'leaderboard-edit',
  query: { limit: 20, type: 'edit' },
})
const { data: resourceData } = await (useFetch as any)('/api/leaderboard', {
  key: 'leaderboard-resource',
  query: { limit: 20, type: 'resource' },
})
const { data: guideData } = await (useFetch as any)('/api/leaderboard', {
  key: 'leaderboard-guide',
  query: { limit: 20, type: 'guide' },
})

const columns = computed(() => [
  { type: 'edit', label: '编辑榜', icon: 'fa6-solid:pen', data: editData.value },
  { type: 'resource', label: '资源榜', icon: 'fa6-solid:download', data: resourceData.value },
  { type: 'guide', label: '攻略榜', icon: 'fa6-solid:book', data: guideData.value },
])

function rankTextClass(rank: number) {
  if (rank === 1) return 'text-yellow-500'
  if (rank === 2) return 'text-gray-400'
  if (rank === 3) return 'text-amber-600'
  return ''
}

const siteName = useSiteName()
useHead({
  title: computed(() => `贡献排行榜 - ${siteName.value}`),
  meta: computed(() => {
    const desc = `${siteName.value} 社区贡献排行榜，展示游戏编辑、资源上传与攻略发布的活跃用户。`
    return [
      { name: 'description', content: desc },
      { property: 'og:title', content: `贡献排行榜 - ${siteName.value}` },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `贡献排行榜 - ${siteName.value}` },
      { name: 'twitter:description', content: desc },
    ]
  }),
})
</script>

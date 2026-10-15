<template>
  <div>
    <div v-if="loading" class="text-center py-8 text-gray-500" role="status">
      <Icon name="fa6-solid:spinner" class="fa-spin text-2xl mb-3" />
      <p>加载补丁资源中...</p>
    </div>
    <div v-else-if="error" class="text-center py-8 text-gray-500" role="alert">
      <Icon name="fa6-solid:circle-info" class="text-2xl mb-3" />
      <p>{{ error }}</p>
      <button
        class="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="retrySeconds > 0"
        @click="$emit('retry')"
      >
        {{ retrySeconds > 0 ? `${retrySeconds} 秒后可重试` : '重新加载' }}
      </button>
    </div>
    <div v-else-if="resources.length" class="space-y-3">
      <div
        v-for="resource in resources"
        :key="resource.id"
        class="border rounded-lg dark:border-zinc-700 overflow-hidden"
      >
        <div class="p-3 md:p-4 text-sm overflow-hidden">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  v-for="type in resource.type"
                  :key="type"
                  class="px-1.5 py-0.5 text-[10px] bg-purple-600 dark:bg-purple-700 text-white rounded font-medium"
                >{{ getMoyuTypeLabel(type) }}</span>
                <span class="font-medium break-all">{{ resource.name || resource.localization_group_name || '补丁资源' }}</span>
                <span
                  v-for="language in resource.language"
                  :key="language"
                  class="px-1.5 py-0.5 text-[10px] rounded font-medium"
                  :class="{
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300': language === 'ja',
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300': language === 'en',
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300': language === 'zh-Hans',
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300': language === 'zh-Hant',
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300': !['ja', 'en', 'zh-Hans', 'zh-Hant'].includes(language),
                  }"
                >{{ getMoyuLanguageLabel(language) }}</span>
                <span v-if="resource.size" class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded">{{ resource.size }}</span>
                <span
                  v-for="platform in resource.platform"
                  :key="platform"
                  class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded"
                >{{ getMoyuPlatformLabel(platform) }}</span>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span v-if="resource.publisher">上传者：{{ resource.publisher.name }}</span>
                <span v-if="resource.localization_group_name">汉化组：{{ resource.localization_group_name }}</span>
                <span v-if="resource.model_name">模型：{{ resource.model_name }}</span>
                <span>{{ formatDate(resource.updated_at) }}</span>
                <span>下载：{{ resource.download_count }}</span>
              </div>
            </div>
            <a
              :href="resource.web_url"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 px-4 py-2 rounded-lg bg-purple-600 dark:bg-purple-700 text-white text-sm flex items-center justify-center gap-2 hover:bg-purple-700 dark:hover:bg-purple-800 active:bg-purple-800 transition-colors duration-150 backdrop-blur-sm"
            >
              <Icon name="fa6-solid:arrow-up-right-from-square" />前往下载
            </a>
          </div>
          <div v-if="resource.note" class="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700 text-xs text-gray-500 dark:text-gray-400 break-all overflow-hidden whitespace-pre-wrap">
            <Icon name="fa6-solid:circle-info" class="mr-1" />备注：{{ resource.note }}
          </div>
        </div>
      </div>
    </div>
    <div v-else class="text-center py-8 text-gray-500">
      <Icon name="fa6-solid:puzzle-piece" class="text-3xl mb-3 text-gray-300 dark:text-zinc-600" />
      <p>{{ missingVndb ? '该游戏尚未关联 VNDB，无法查询补丁' : '暂无补丁资源' }}</p>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
      补丁来源：<a href="https://www.moyu.moe" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">鲲 Galgame 补丁</a>。
      下载链接及密码请前往补丁来源页面查看。
    </p>
  </div>
</template>

<script setup lang="ts">
import type { MoyuResource } from '~/types/moyu'
import { getMoyuTypeLabel, getMoyuLanguageLabel, getMoyuPlatformLabel } from '~/utils/moyu'

defineProps<{
  resources: MoyuResource[]
  loading: boolean
  error: string
  retrySeconds: number
  missingVndb: boolean
}>()
defineEmits<{ retry: [] }>()
const { formatDate } = useFormatDate()
</script>

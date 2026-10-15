<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">封面扫描</h1>

    <!-- 操作栏 -->
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
      <p class="text-sm text-gray-500 mb-4">
        扫描所有游戏封面链接，检测失效图片。对于有 VNDB ID 的游戏，可以从 VNDB 重新获取封面并保存为本地 WebP。
      </p>
      <AdminKumoButton variant="primary"
        @click="startScan"
        :disabled="scanning"
      >
        <Icon :name="scanning ? 'fa6-solid:spinner' : 'fa6-solid:magnifying-glass'" />
        {{ scanning ? '扫描中...' : '开始扫描' }}
      </AdminKumoButton>
    </div>

    <!-- 扫描结果 -->
    <div v-if="scanResult" class="space-y-4">
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
        <div class="flex items-center gap-4 text-sm">
          <span>共扫描 <strong>{{ scanResult.total }}</strong> 个封面</span>
          <span class="text-red-500">失效 <strong>{{ brokenItems.length }}</strong> 个</span>
          <span v-if="fixedCount > 0" class="text-green-500">已修复 <strong>{{ fixedCount }}</strong> 个</span>
          <AdminKumoButton variant="primary" size="toolbar"
            v-if="fixableItems.length > 0"
            @click="fixAll"
            :disabled="fixingAll"
          >
            <Icon :name="fixingAll ? 'fa6-solid:spinner' : 'fa6-solid:wand-magic-sparkles'" />
            {{ fixingAll ? `修复中 (${fixProgress}/${fixableItems.length})` : `一键修复全部 (${fixableItems.length})` }}
          </AdminKumoButton>
        </div>
      </div>

      <div v-if="brokenItems.length === 0" class="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center text-green-600 dark:text-green-400">
        <Icon name="fa6-solid:circle-check" class="text-3xl mb-2" />
        <p>所有封面链接正常</p>
      </div>

      <div v-else class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="divide-y dark:divide-zinc-700">
          <div
            v-for="item in brokenItems"
            :key="item.id"
            class="p-4 flex items-center gap-4"
          >
            <div class="w-16 h-20 bg-gray-100 dark:bg-zinc-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              <Icon name="fa6-solid:file-circle-xmark" class="text-gray-400 text-xl" v-if="!item.fixed" />
              <img v-else :src="item.newCoverUrl" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <NuxtLink :to="`/games/${item.id}`" class="font-medium text-blue-500 hover:underline truncate" target="_blank">
                  {{ item.title }}
                </NuxtLink>
                <span v-if="item.fixed" class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">已修复</span>
                <span v-else-if="item.fixing" class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Icon name="fa6-solid:spinner" class="fa-spin mr-1" />修复中
                </span>
                <span v-else-if="item.error" class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">{{ item.error }}</span>
              </div>
              <div class="text-xs text-gray-500 mt-1 space-x-3">
                <span>原因：{{ item.reason }}</span>
                <span v-if="item.vndbId">VNDB：{{ item.vndbId }}</span>
                <span v-else class="text-orange-500">无 VNDB ID</span>
              </div>
              <div class="text-xs text-gray-400 mt-0.5 truncate">{{ item.coverImage }}</div>
            </div>
            <AdminKumoButton variant="primary" size="sm"
              v-if="item.vndbId && !item.fixed && !item.fixing"
              @click="fixOne(item)"
              class="flex-shrink-0"
            >
              <Icon name="fa6-solid:download" />修复
            </AdminKumoButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { authFetch } = useAuthRequest()
const toast = useToast()

const scanning = ref(false)
const scanResult = ref<{ total: number; broken: any[] } | null>(null)
const fixingAll = ref(false)
const fixProgress = ref(0)
const fixedCount = ref(0)

interface BrokenItem {
  id: number
  title: string
  coverImage: string
  vndbId: string | null
  reason: string
  fixing?: boolean
  fixed?: boolean
  error?: string
  newCoverUrl?: string
}

const brokenItems = ref<BrokenItem[]>([])
const fixableItems = computed(() => brokenItems.value.filter(i => i.vndbId && !i.fixed && !i.error))

async function startScan() {
  scanning.value = true
  scanResult.value = null
  brokenItems.value = []
  fixedCount.value = 0

  try {
    const result = await authFetch('/api/admin/scan-covers', { method: 'POST' }) as any
    scanResult.value = result
    brokenItems.value = result.broken.map((b: any) => ({ ...b, fixing: false, fixed: false, error: '' }))
    if (result.broken.length === 0) {
      toast.success('所有封面正常')
    } else {
      toast.warning(`发现 ${result.broken.length} 个失效封面`)
    }
  } catch (err: any) {
    toast.error(err.data?.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

async function fixOne(item: BrokenItem) {
  item.fixing = true
  item.error = ''

  try {
    const result = await authFetch('/api/admin/fix-cover', {
      method: 'POST',
      body: { gameId: item.id },
    }) as any
    item.fixed = true
    item.newCoverUrl = result.newCoverUrl
    fixedCount.value++
  } catch (err: any) {
    item.error = err.data?.message || '修复失败'
  } finally {
    item.fixing = false
  }
}

async function fixAll() {
  fixingAll.value = true
  fixProgress.value = 0

  for (const item of fixableItems.value) {
    await fixOne(item)
    fixProgress.value++
    // 间隔 500ms 避免请求过快
    await new Promise(r => setTimeout(r, 500))
  }

  fixingAll.value = false
  toast.success(`修复完成，成功 ${fixedCount.value} 个`)
}

useHead({ title: '封面扫描 - 管理后台' })
</script>

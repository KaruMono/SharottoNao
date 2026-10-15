<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">广告管理</h1>
      <AdminKumoButton variant="primary"
        @click="openCreateModal"
      >
        <Icon name="fa6-solid:plus" />添加广告
      </AdminKumoButton>
    </div>

    <!-- 广告位说明 -->
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 text-sm text-blue-700 dark:text-blue-300">
      <div class="font-medium mb-2"><Icon name="fa6-solid:circle-info" class="mr-1.5" />可用广告位</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <div v-for="s in SLOTS" :key="s.id" class="flex items-center gap-2">
          <span class="font-mono text-xs bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">{{ s.id }}</span>
          <span class="text-xs">{{ s.label }} · {{ s.ratio }}</span>
        </div>
      </div>
    </div>

    <!-- 广告列表 -->
    <div v-if="loading" class="text-center py-12 text-gray-400">
      <Icon name="fa6-solid:spinner" class="fa-spin text-2xl" />
    </div>
    <div v-else-if="!ads.length" class="text-center py-12 text-gray-400">暂无广告</div>
    <div v-else class="space-y-3">
      <div
        v-for="ad in ads"
        :key="ad.id"
        class="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow flex items-center gap-4"
        :class="{ 'opacity-50': !ad.enabled }"
      >
        <!-- 图片预览 -->
        <a :href="ad.linkUrl" target="_blank" rel="noopener noreferrer" class="flex-shrink-0">
          <img
            :src="ad.imageUrl"
            class="w-24 h-16 object-cover rounded-lg border dark:border-zinc-700"
            loading="lazy"
          />
        </a>

        <!-- 信息 -->
        <div class="flex-1 min-w-0 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-sm">{{ ad.name }}</span>
            <span class="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-zinc-700 font-mono">{{ ad.slot }}</span>
            <span v-if="ad.icon" class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-500">
              <FaIcon :icon="ad.icon" />{{ ad.icon }}
            </span>
            <span
              class="px-2 py-0.5 text-[10px] rounded-full"
              :class="ad.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-700 text-gray-500'"
            >{{ ad.enabled ? '启用' : '停用' }}</span>
          </div>
          <div class="text-xs text-gray-400 truncate">{{ ad.linkUrl }}</div>
          <div class="text-xs text-gray-400">排序: {{ ad.sortOrder }} · {{ ad.openInNewTab ? '新窗口' : '当前窗口' }} · {{ ad.showOnMobile ? '移动端可见' : '移动端隐藏' }}</div>
        </div>

        <!-- 操作 -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            @click="toggleEnabled(ad)"
            class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 transition"
            :title="ad.enabled ? '停用' : '启用'"
          >
            <Icon :name="ad.enabled ? 'fa6-solid:eye' : 'fa6-solid:eye-slash'" />
          </button>
          <button
            @click="openEditModal(ad)"
            class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 transition"
          >
            <Icon name="fa6-solid:pen" class="text-xs" />
          </button>
          <button
            @click="deleteAd(ad.id)"
            class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition"
          >
            <Icon name="fa6-solid:trash" class="text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑弹窗 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        @click.self="showModal = false"
      >
        <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 class="text-lg font-semibold mb-5">{{ editingAd ? '编辑广告' : '添加广告' }}</h2>

            <div class="space-y-4">
              <!-- 广告名称 -->
              <div>
                <label class="block text-sm font-medium mb-1">广告名称 <span class="text-red-500">*</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="内部标识用，不公开显示"
                  class="admin-input w-full"
                />
              </div>

              <!-- 广告位 -->
              <div>
                <label class="block text-sm font-medium mb-1">广告位 <span class="text-red-500">*</span></label>
                <AdminSelect aria-label="广告位 *"
                  v-model="form.slot"
                  class="w-full"
                >
                  <option value="">请选择广告位</option>
                  <option v-for="s in SLOTS" :key="s.id" :value="s.id">
                    {{ s.label }} ({{ s.id }}) · {{ s.ratio }}
                  </option>
                </AdminSelect>
              </div>

              <!-- 菜单图标 -->
              <div>
                <label class="block text-sm font-medium mb-1">菜单图标</label>
                <div class="flex items-center gap-2">
                  <div class="w-10 h-10 rounded-lg border dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700 flex items-center justify-center text-gray-500">
                    <FaIcon :icon="form.icon || 'fa6-solid:rectangle-ad'" />
                  </div>
                  <input
                    v-model="form.icon"
                    type="text"
                    placeholder="如：fa-solid fa-bullhorn"
                    class="admin-input flex-1"
                  />
                </div>
                <p class="text-xs text-gray-400 mt-1">用于手机侧边菜单显示；留空时使用默认广告图标。</p>
              </div>

              <!-- 广告图片 -->
              <div>
                <label class="block text-sm font-medium mb-1">广告图片 <span class="text-red-500">*</span></label>
                <p class="text-xs text-gray-400 mb-2">横幅建议使用 8:1，侧栏及下载页左右广告使用 4:3。手机端横幅为 6:1，比例不符时居中裁剪。</p>
                <div class="space-y-2">
                  <!-- 预览 -->
                  <div
                    v-if="form.imageUrl"
                    class="relative w-full aspect-[4/1] rounded-lg overflow-hidden border dark:border-zinc-600 bg-gray-50 dark:bg-zinc-700"
                  >
                    <img :src="form.imageUrl" class="w-full h-full object-contain" />
                    <button
                      @click="form.imageUrl = ''"
                      class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    >
                      <Icon name="fa6-solid:xmark" class="text-xs" />
                    </button>
                  </div>
                  <!-- 上传按钮 -->
                  <div class="flex gap-2">
                    <input
                      ref="fileInput"
                      type="file"
                      accept="image/*,.gif"
                      class="hidden"
                      @change="handleFileUpload"
                    />
                    <AdminKumoButton variant="secondary"
                      type="button"
                      @click="fileInput?.click()"
                      :disabled="uploading"
                      class="flex-1"
                    >
                      <Icon name="fa6-solid:upload"  :class="{ 'fa-spin': uploading }" />
                      {{ uploading ? '上传中...' : '上传图片 / GIF' }}
                    </AdminKumoButton>
                    <span class="text-xs text-gray-400 self-center">或</span>
                    <input
                      v-model="form.imageUrl"
                      type="text"
                      placeholder="直接输入图片 URL"
                      class="admin-input flex-1"
                    />
                  </div>
                </div>
              </div>

              <!-- 跳转链接 -->
              <div>
                <label class="block text-sm font-medium mb-1">跳转链接 <span class="text-red-500">*</span></label>
                <input
                  v-model="form.linkUrl"
                  type="url"
                  placeholder="https://example.com"
                  class="admin-input w-full"
                />
              </div>

              <!-- 排序 -->
              <div>
                <label class="block text-sm font-medium mb-1">排序</label>
                <input
                  v-model.number="form.sortOrder"
                  type="number"
                  class="admin-input w-full"
                />
              </div>

              <!-- 开关 -->
              <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" v-model="form.enabled" class="w-4 h-4" />
                  <span class="text-sm">启用广告</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" v-model="form.openInNewTab" class="w-4 h-4" />
                  <span class="text-sm">新窗口打开</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" v-model="form.showOnMobile" class="w-4 h-4" />
                  <span class="text-sm">移动端可见</span>
                </label>
              </div>
            </div>

            <div class="flex gap-3 mt-6">
              <AdminKumoButton variant="secondary"
                @click="showModal = false"
                class="flex-1"
              >取消</AdminKumoButton>
              <AdminKumoButton variant="primary"
                @click="handleSave"
                :disabled="saving"
                class="flex-1"
              >{{ saving ? '保存中...' : '保存' }}</AdminKumoButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const SLOTS = [
  { id: 'nav_menu',              label: '菜单栏广告',       ratio: '文字链接 + 悬浮图片' },
  { id: 'home_header_strip',     label: '首页顶栏下方文字广告', ratio: '文字条 + 悬浮图片' },
  { id: 'home_top',              label: '首页顶部横幅',     ratio: '横长条' },
  { id: 'home_sidebar',          label: '首页右侧边栏',     ratio: '4:3' },
  { id: 'game_list_top',         label: '游戏列表顶部横幅', ratio: '横长条' },
  { id: 'game_detail_sidebar',   label: '游戏详情页左栏底部', ratio: '4:3' },
  { id: 'game_resource_top',     label: '资源列表顶部横幅', ratio: '横长条' },
  { id: 'game_resource_bottom',  label: '资源列表底部横幅', ratio: '横长条' },
  { id: 'game_detail_bottom',    label: '游戏详情内容底部横幅', ratio: '横长条' },
  { id: 'download_left',         label: '下载页左侧广告',   ratio: '4:3' },
  { id: 'download_right',        label: '下载页右侧广告',   ratio: '4:3' },
  { id: 'download_top',          label: '下载页顶部横幅',   ratio: '横长条' },
  { id: 'download_bottom',       label: '下载页底部横幅',   ratio: '横长条' },
]

interface Ad {
  id: number
  name: string
  slot: string
  icon?: string | null
  imageUrl: string
  linkUrl: string
  enabled: boolean
  showOnMobile: boolean
  openInNewTab: boolean
  sortOrder: number
}

const { authFetch } = useAuthRequest()
const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const showModal = ref(false)
const editingAd = ref<Ad | null>(null)
const ads = ref<Ad[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const defaultForm = () => ({
  name: '',
  slot: '',
  icon: '',
  imageUrl: '',
  linkUrl: '',
  enabled: true,
  showOnMobile: true,
  openInNewTab: true,
  sortOrder: 0,
})

const form = reactive(defaultForm())

async function loadAds() {
  loading.value = true
  try {
    ads.value = await authFetch<Ad[]>('/api/admin/ads')
  } catch (e: any) {
    toast.error(e.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  editingAd.value = null
  Object.assign(form, defaultForm())
  showModal.value = true
}

function openEditModal(ad: Ad) {
  editingAd.value = ad
  Object.assign(form, {
    name: ad.name,
    slot: ad.slot,
    icon: ad.icon || '',
    imageUrl: ad.imageUrl,
    linkUrl: ad.linkUrl,
    enabled: ad.enabled,
    showOnMobile: ad.showOnMobile ?? true,
    openInNewTab: ad.openInNewTab,
    sortOrder: ad.sortOrder,
  })
  showModal.value = true
}

async function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: fd,
    })
    form.imageUrl = res.url
  } catch (err: any) {
    toast.error(err.data?.message || '上传失败')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function handleSave() {
  if (!form.name || !form.slot || !form.imageUrl || !form.linkUrl) {
    toast.error('请填写所有必填项')
    return
  }
  saving.value = true
  try {
    if (editingAd.value) {
      await authFetch(`/api/admin/ads/${editingAd.value.id}`, { method: 'PUT', body: form })
      toast.success('广告已更新')
    } else {
      await authFetch('/api/admin/ads', { method: 'POST', body: form })
      toast.success('广告已添加')
    }
    showModal.value = false
    await loadAds()
    await refreshNuxtData()
    await refreshNuxtData('nav-menu-ads')
  } catch (e: any) {
    toast.error(e.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(ad: Ad) {
  try {
    await authFetch(`/api/admin/ads/${ad.id}`, { method: 'PUT', body: { enabled: !ad.enabled } })
    ad.enabled = !ad.enabled
    await refreshNuxtData()
    await refreshNuxtData('nav-menu-ads')
  } catch (e: any) {
    toast.error(e.data?.message || '操作失败')
  }
}

async function deleteAd(id: number) {
  if (!confirm('确定要删除这条广告吗？')) return
  try {
    await authFetch(`/api/admin/ads/${id}`, { method: 'DELETE' })
    toast.success('已删除')
    await loadAds()
    await refreshNuxtData()
    await refreshNuxtData('nav-menu-ads')
  } catch (e: any) {
    toast.error(e.data?.message || '删除失败')
  }
}

onMounted(loadAds)
</script>

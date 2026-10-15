<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">公告管理</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 侧边栏公告 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="px-5 py-4 border-b dark:border-zinc-700 flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Icon name="fa6-solid:bullhorn" class="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 class="font-semibold">侧边栏公告</h2>
            <p class="text-sm text-gray-500">显示在首页和游戏列表侧边栏</p>
          </div>
        </div>
        <form @submit.prevent="saveSidebarAnnouncement" class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">公告标题</label>
            <input 
              v-model="sidebarForm.title"
              type="text" 
              class="admin-input w-full"
              placeholder="输入公告标题..."
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">公告内容</label>
            <textarea 
              v-model="sidebarForm.content"
              class="admin-textarea w-full"
              rows="4"
              placeholder="输入公告内容..."
            ></textarea>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="sidebarForm.isActive"
              class="w-5 h-5 rounded border-gray-300 dark:border-zinc-600"
            />
            <span class="text-sm">启用公告</span>
          </label>
          <AdminKumoButton variant="primary"
            type="submit"
            :disabled="savingSidebar"
            class="w-full"
          >
            {{ savingSidebar ? '保存中...' : '保存设置' }}
          </AdminKumoButton>
        </form>
      </div>

      <!-- 全局弹窗公告 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl shadow overflow-hidden">
        <div class="px-5 py-4 border-b dark:border-zinc-700 flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Icon name="fa6-solid:bell" class="text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 class="font-semibold">全局弹窗公告</h2>
            <p class="text-sm text-gray-500">用户访问网站时在页面中央显示</p>
          </div>
        </div>
        <form @submit.prevent="saveGlobalAnnouncement" class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">弹窗标题</label>
            <input 
              v-model="globalForm.title"
              type="text" 
              class="admin-input w-full"
              placeholder="输入弹窗标题..."
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">弹窗内容</label>
            <textarea 
              v-model="globalForm.content"
              class="admin-textarea w-full"
              rows="6"
              placeholder="输入弹窗内容，支持简单HTML..."
            ></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">按钮文字</label>
              <input 
                v-model="globalForm.buttonText"
                type="text" 
                class="admin-input w-full"
                placeholder="我知道了"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">显示频率</label>
              <AdminSelect aria-label="显示频率"
                v-model="globalForm.frequency"
                class="w-full"
              >
                <option value="once">仅显示一次</option>
                <option value="daily">每天一次</option>
                <option value="always">每次访问</option>
              </AdminSelect>
            </div>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="globalForm.isActive"
              class="w-5 h-5 rounded border-gray-300 dark:border-zinc-600"
            />
            <span class="text-sm">启用弹窗公告</span>
          </label>
          <AdminKumoButton variant="primary"
            type="submit"
            :disabled="savingGlobal"
            class="w-full"
          >
            {{ savingGlobal ? '保存中...' : '保存设置' }}
          </AdminKumoButton>
        </form>
      </div>
    </div>

    <!-- 预览 -->
    <div class="mt-8">
      <h2 class="text-lg font-semibold mb-4">弹窗预览</h2>
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow flex items-center justify-center min-h-[300px]">
        <div v-if="globalForm.isActive" class="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border dark:border-zinc-700 overflow-hidden">
          <div class="px-6 py-5 border-b dark:border-zinc-700">
            <h3 class="text-lg font-semibold">{{ globalForm.title || '公告标题' }}</h3>
          </div>
          <div class="px-6 py-5">
            <p class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{{ globalForm.content || '公告内容预览...' }}</p>
          </div>
          <div class="px-6 py-4 bg-gray-50 dark:bg-zinc-700/50">
            <AdminKumoButton variant="primary" class="w-full">
              {{ globalForm.buttonText || '我知道了' }}
            </AdminKumoButton>
          </div>
        </div>
        <div v-else class="text-gray-400 text-center">
          <Icon name="fa6-solid:eye-slash" class="text-3xl mb-2" />
          <p>弹窗公告未启用</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const { authFetch } = useAuthRequest()
const toast = useToast()

// 侧边栏公告表单
const sidebarForm = reactive({
  title: '',
  content: '',
  isActive: false,
})

// 全局弹窗公告表单
const globalForm = reactive({
  title: '',
  content: '',
  buttonText: '我知道了',
  frequency: 'once' as 'once' | 'daily' | 'always',
  isActive: false,
})

const savingSidebar = ref(false)
const savingGlobal = ref(false)

// 加载现有公告设置
async function loadAnnouncements() {
  try {
    const data: any = await ($fetch as any)('/api/announcements/settings')

    if (data.sidebar) {
      Object.assign(sidebarForm, data.sidebar)
    }
    if (data.global) {
      Object.assign(globalForm, data.global)
    }
  } catch (error) {
    // 忽略错误，使用默认值
  }
}

onMounted(() => {
  loadAnnouncements()
})

async function saveSidebarAnnouncement() {
  savingSidebar.value = true
  try {
    await authFetch('/api/admin/announcements/sidebar', {
      method: 'PUT',
      body: sidebarForm,
    })
    toast.success('侧边栏公告保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    savingSidebar.value = false
  }
}

async function saveGlobalAnnouncement() {
  savingGlobal.value = true
  try {
    await authFetch('/api/admin/announcements/global', {
      method: 'PUT',
      body: globalForm,
    })
    toast.success('全局公告保存成功')
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    savingGlobal.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `公告管理 - ${siteName.value} 管理后台`),
})
</script>

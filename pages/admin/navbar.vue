<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">导航栏设置</h1>

    <div v-if="loading" class="text-center py-12 text-gray-400">
      <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
    </div>

    <template v-else>
      <!-- 左侧导航链接 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700 mb-4">
          <h2 class="font-semibold text-lg">导航链接（左侧文字按钮）</h2>
          <div class="flex gap-2">
            <button 
              @click="addNavLink"
              class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
            >
              <i class="fa-solid fa-plus mr-1"></i>添加链接
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <template v-for="(link, index) in config.navLinks" :key="link.id">
            <div 
              class="flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-zinc-700 transition"
              :class="link.visible ? 'bg-white dark:bg-zinc-800' : 'bg-gray-50 dark:bg-zinc-900 opacity-60'"
            >
              <!-- 拖拽手柄 -->
              <div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <i class="fa-solid fa-grip-vertical"></i>
              </div>

              <!-- 显示/隐藏 -->
              <label class="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  v-model="link.visible"
                  class="w-4 h-4"
                />
              </label>

              <!-- 图标预览 -->
              <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                <i :class="link.icon" class="text-gray-500 dark:text-gray-400"></i>
              </div>

              <!-- 内容 -->
              <div v-if="link.isBuiltin" class="flex-1 min-w-0">
                <div class="text-sm font-medium">{{ link.label }}</div>
                <div class="text-xs text-gray-400">{{ link.to }}</div>
              </div>
              <template v-else>
                <input 
                  v-model="link.label" 
                  placeholder="显示名称"
                  class="w-20 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <input 
                  v-model="link.to" 
                  placeholder="/path 或 https://..."
                  class="flex-1 min-w-0 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <input 
                  v-model="link.icon" 
                  placeholder="图标 class"
                  class="w-40 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" v-model="link.requireAuth" class="w-3.5 h-3.5" />
                  需登录
                </label>
              </template>

              <!-- 标签 -->
              <span v-if="link.isBuiltin" class="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                内置
              </span>
              <span v-else class="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
                自定义
              </span>

              <!-- 排序按钮 -->
              <div class="flex flex-col gap-0.5 flex-shrink-0">
                <button 
                  @click="moveItem(config.navLinks, index, -1)"
                  :disabled="index === 0"
                  class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
                >
                  <i class="fa-solid fa-chevron-up text-[10px]"></i>
                </button>
                <button 
                  @click="moveItem(config.navLinks, index, 1)"
                  :disabled="index === config.navLinks.length - 1"
                  class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
                >
                  <i class="fa-solid fa-chevron-down text-[10px]"></i>
                </button>
              </div>

              <!-- 删除（仅自定义） -->
              <button 
                v-if="!link.isBuiltin"
                @click="removeNavLink(index)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
              >
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
              <div v-else class="w-8 flex-shrink-0"></div>
            </div>

          </template>
        </div>

        <p class="text-xs text-gray-400 mt-3">
          <i class="fa-solid fa-circle-info mr-1"></i>
          内置链接只能设置显示/隐藏和排序，自定义链接可以编辑所有属性
        </p>
      </div>

      <!-- 右侧图标按钮 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700 mb-4">
          <h2 class="font-semibold text-lg">图标按钮（右侧）</h2>
          <button 
            @click="addIconButton"
            class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
          >
            <i class="fa-solid fa-plus mr-1"></i>添加按钮
          </button>
        </div>

        <div class="space-y-2">
          <div 
            v-for="(btn, index) in config.iconButtons" 
            :key="btn.id"
            class="flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-zinc-700 transition"
            :class="btn.visible ? 'bg-white dark:bg-zinc-800' : 'bg-gray-50 dark:bg-zinc-900 opacity-60'"
          >
            <div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fa-solid fa-grip-vertical"></i>
            </div>

            <label class="flex items-center cursor-pointer">
              <input type="checkbox" v-model="btn.visible" class="w-4 h-4" />
            </label>

            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <i :class="btn.icon" class="text-gray-500 dark:text-gray-400"></i>
            </div>

            <div v-if="btn.isBuiltin" class="flex-1 min-w-0">
              <div class="text-sm font-medium">{{ btn.label }}</div>
              <div class="text-xs text-gray-400">动作: {{ btn.action }}</div>
            </div>
            <template v-else>
              <input 
                v-model="btn.label" 
                placeholder="按钮名称"
                class="w-24 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <input 
                v-model="btn.action" 
                placeholder="链接 URL 或路径"
                class="flex-1 min-w-0 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <input 
                v-model="btn.icon" 
                placeholder="图标 class"
                class="w-40 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                <input type="checkbox" v-model="btn.requireAuth" class="w-3.5 h-3.5" />
                需登录
              </label>
            </template>

            <span v-if="btn.isBuiltin" class="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
              内置
            </span>
            <span v-else class="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
              自定义
            </span>

            <div class="flex flex-col gap-0.5 flex-shrink-0">
              <button 
                @click="moveItem(config.iconButtons, index, -1)"
                :disabled="index === 0"
                class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <i class="fa-solid fa-chevron-up text-[10px]"></i>
              </button>
              <button 
                @click="moveItem(config.iconButtons, index, 1)"
                :disabled="index === config.iconButtons.length - 1"
                class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <i class="fa-solid fa-chevron-down text-[10px]"></i>
              </button>
            </div>

            <button 
              v-if="!btn.isBuiltin"
              @click="removeIconButton(index)"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
            >
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
            <div v-else class="w-8 flex-shrink-0"></div>
          </div>
        </div>

        <p class="text-xs text-gray-400 mt-3">
          <i class="fa-solid fa-circle-info mr-1"></i>
          自定义按钮的"动作"填写链接地址（如 https://... 或 /path），内置按钮有特殊行为不可修改
        </p>
      </div>

      <!-- 页脚链接 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700 mb-4">
          <h2 class="font-semibold text-lg">页脚链接</h2>
          <button 
            @click="addFooterLink"
            class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
          >
            <i class="fa-solid fa-plus mr-1"></i>添加链接
          </button>
        </div>

        <div class="space-y-2">
          <div 
            v-for="(link, index) in config.footerLinks" 
            :key="link.id"
            class="flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-zinc-700 transition"
            :class="link.visible ? 'bg-white dark:bg-zinc-800' : 'bg-gray-50 dark:bg-zinc-900 opacity-60'"
          >
            <!-- 拖拽手柄 -->
            <div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fa-solid fa-grip-vertical"></i>
            </div>

            <!-- 显示/隐藏 -->
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" v-model="link.visible" class="w-4 h-4" />
            </label>

            <!-- 图标预览 -->
            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <i :class="link.icon || 'fa-solid fa-link'" class="text-gray-500 dark:text-gray-400"></i>
            </div>

            <!-- 内容 -->
            <template v-if="link.isBuiltin">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">{{ link.label }}</div>
                <div class="text-xs text-gray-400">{{ link.url }}</div>
              </div>
            </template>
            <template v-else>
              <input 
                v-model="link.label" 
                placeholder="显示名称"
                class="w-24 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <input 
                v-model="link.url" 
                placeholder="链接地址 https://..."
                class="flex-1 min-w-0 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <input 
                v-model="link.icon" 
                placeholder="图标 class"
                class="w-40 px-2 py-1 text-sm rounded border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                <input type="checkbox" v-model="link.openInNewTab" class="w-3.5 h-3.5" />
                新窗口
              </label>
              <label class="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                <input type="checkbox" v-model="link.requireAuth" class="w-3.5 h-3.5" />
                需登录
              </label>
            </template>

            <!-- 标签 -->
            <span v-if="link.isBuiltin" class="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
              内置
            </span>
            <span v-else class="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
              自定义
            </span>

            <!-- 排序按钮 -->
            <div class="flex flex-col gap-0.5 flex-shrink-0">
              <button 
                @click="moveItem(config.footerLinks, index, -1)"
                :disabled="index === 0"
                class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <i class="fa-solid fa-chevron-up text-[10px]"></i>
              </button>
              <button 
                @click="moveItem(config.footerLinks, index, 1)"
                :disabled="index === config.footerLinks.length - 1"
                class="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <i class="fa-solid fa-chevron-down text-[10px]"></i>
              </button>
            </div>

            <!-- 删除（仅自定义） -->
            <button 
              v-if="!link.isBuiltin"
              @click="removeFooterLink(index)"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
            >
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
            <div v-else class="w-8 flex-shrink-0"></div>
          </div>
        </div>

        <p class="text-xs text-gray-400 mt-3">
          <i class="fa-solid fa-circle-info mr-1"></i>
          内置链接只能设置显示/隐藏和排序，自定义链接可以编辑所有属性
        </p>
      </div>

      <!-- 图标参考 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow mb-6">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700 mb-4">图标参考</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          使用 
          <a href="https://fontawesome.com/search?o=r&m=free&s=solid" target="_blank" class="text-blue-500 hover:underline">Font Awesome 6 Free</a> 
          图标，格式如 <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-700 rounded text-xs">fa-solid fa-house</code>
        </p>
        <div class="flex flex-wrap gap-3">
          <div 
            v-for="icon in sampleIcons" 
            :key="icon.class"
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-700/50 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
            @click="copyIconClass(icon.class)"
          >
            <i :class="icon.class" class="w-4 text-center text-gray-500"></i>
            <span class="text-xs text-gray-500">{{ icon.label }}</span>
          </div>
        </div>
      </div>

      <!-- 保存 -->
      <div class="flex justify-end">
        <button 
          @click="handleSave"
          :disabled="saving"
          class="px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
        >
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

interface NavLink {
  id: string
  label: string
  to: string
  icon: string
  visible: boolean
  isBuiltin: boolean
  requireAuth: boolean
  sortOrder: number
}

interface IconButton {
  id: string
  label: string
  action: string
  icon: string
  visible: boolean
  isBuiltin: boolean
  requireAuth: boolean
  sortOrder: number
}

interface FooterLink {
  id: string
  label: string
  url: string
  icon: string
  visible: boolean
  isBuiltin: boolean
  openInNewTab: boolean
  requireAuth: boolean
  sortOrder: number
}

const { authFetch } = useAuthRequest()
const toast = useToast()
const loading = ref(true)
const saving = ref(false)

const config = reactive<{ navLinks: NavLink[]; iconButtons: IconButton[]; footerLinks: FooterLink[] }>({
  navLinks: [],
  iconButtons: [],
  footerLinks: [],
})
const publicNavConfig = useNavConfig()

const sampleIcons = [
  { class: 'fa-solid fa-house', label: 'house' },
  { class: 'fa-solid fa-gamepad', label: 'gamepad' },
  { class: 'fa-solid fa-book', label: 'book' },
  { class: 'fa-solid fa-star', label: 'star' },
  { class: 'fa-solid fa-heart', label: 'heart' },
  { class: 'fa-solid fa-link', label: 'link' },
  { class: 'fa-solid fa-globe', label: 'globe' },
  { class: 'fa-solid fa-envelope', label: 'envelope' },
  { class: 'fa-solid fa-circle-info', label: 'info' },
  { class: 'fa-solid fa-question', label: 'question' },
  { class: 'fa-solid fa-fire', label: 'fire' },
  { class: 'fa-solid fa-bolt', label: 'bolt' },
  { class: 'fa-brands fa-github', label: 'github' },
  { class: 'fa-brands fa-discord', label: 'discord' },
  { class: 'fa-brands fa-telegram', label: 'telegram' },
  { class: 'fa-brands fa-twitter', label: 'twitter' },
]

async function loadConfig() {
  loading.value = true
  try {
    const data = await authFetch<{ navLinks: NavLink[]; iconButtons: IconButton[]; footerLinks: FooterLink[] }>('/api/admin/nav-config')
    config.navLinks = data.navLinks
    config.iconButtons = data.iconButtons
    config.footerLinks = data.footerLinks ?? []
  } catch (err: any) {
    toast.error(err.data?.message || '加载配置失败')
  } finally {
    loading.value = false
  }
}

function addNavLink() {
  const id = `custom_${Date.now()}`
  config.navLinks.push({
    id,
    label: '新链接',
    to: '',
    icon: 'fa-solid fa-link',
    visible: true,
    isBuiltin: false,
    requireAuth: false,
    sortOrder: config.navLinks.length,
  })
}

function removeNavLink(index: number) {
  config.navLinks.splice(index, 1)
}

function addIconButton() {
  const id = `custom_btn_${Date.now()}`
  config.iconButtons.push({
    id,
    label: '新按钮',
    action: 'https://',
    icon: 'fa-solid fa-link',
    visible: true,
    isBuiltin: false,
    requireAuth: false,
    sortOrder: config.iconButtons.length,
  })
}

function removeIconButton(index: number) {
  config.iconButtons.splice(index, 1)
}

function addFooterLink() {
  const id = `custom_footer_${Date.now()}`
  config.footerLinks.push({
    id,
    label: '新链接',
    url: 'https://',
    icon: 'fa-solid fa-link',
    visible: true,
    isBuiltin: false,
    openInNewTab: true,
    requireAuth: false,
    sortOrder: config.footerLinks.length,
  })
}

function removeFooterLink(index: number) {
  config.footerLinks.splice(index, 1)
}

function moveItem<T>(arr: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= arr.length) return
  const temp = arr[index]
  arr[index] = arr[target]
  arr[target] = temp
}

function copyIconClass(cls: string) {
  navigator.clipboard.writeText(cls)
  toast.success(`已复制: ${cls}`)
}

async function handleSave() {
  saving.value = true
  try {
    config.navLinks.forEach((l, i) => l.sortOrder = i)
    config.iconButtons.forEach((b, i) => b.sortOrder = i)
    config.footerLinks.forEach((f, i) => f.sortOrder = i)

    await authFetch('/api/admin/nav-config', {
      method: 'PUT',
      body: {
        navLinks: config.navLinks,
        iconButtons: config.iconButtons,
        footerLinks: config.footerLinks,
      },
    })
    await refreshNuxtData()
    publicNavConfig.value = await $fetch<{ navLinks: NavLink[]; iconButtons: IconButton[]; footerLinks: FooterLink[] }>('/api/nav-config')
    toast.success('配置已保存，前台缓存已失效')
  } catch (err: any) {
    toast.error(err.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

await loadConfig()

const siteName = useSiteName()
useHead({
  title: computed(() => `导航栏设置 - ${siteName.value} 管理后台`),
})
</script>

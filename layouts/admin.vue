<template>
  <div class="bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-gray-100 min-h-screen">
    <AppLoadingBar />

    <!-- 顶栏 -->
    <header class="fixed top-0 inset-x-0 z-50 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 h-14">
      <div class="flex items-center justify-between px-4 md:px-6 h-full">
        <div class="flex items-center gap-3 md:gap-4">
          <!-- 移动端菜单按钮 -->
          <button 
            @click="showMobileSidebar = !showMobileSidebar"
            class="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700"
          >
            <i :class="showMobileSidebar ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
          </button>
          <NuxtLink to="/" class="text-lg font-semibold">{{ siteName }}</NuxtLink>
          <span class="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">管理后台</span>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink :to="frontendReturnPath" class="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <i class="fa-solid fa-arrow-left mr-1"></i><span class="hidden sm:inline">返回前台</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="flex pt-14">
      <!-- 移动端侧边栏遮罩 -->
      <Transition name="fade">
        <div 
          v-if="showMobileSidebar"
          class="fixed inset-0 bg-black/50 z-40 lg:hidden"
          @click="showMobileSidebar = false"
        ></div>
      </Transition>
      
      <!-- 侧边栏 -->
      <aside 
        class="fixed left-0 top-14 bottom-0 w-56 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 overflow-y-auto z-50 transition-transform duration-300 lg:translate-x-0"
        :class="showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      >
        <nav class="p-4 space-y-1">
          <template v-for="item in navItems" :key="item.to || item.separator">
            <div v-if="item.separator" class="pt-4 pb-2 px-4 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ item.separator }}</div>
            <a 
              v-else
              :href="item.to"
              class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition cursor-pointer"
              :class="isNavActive(item) ? 'bg-gray-100 dark:bg-zinc-700 font-medium' : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50'"
              @click.prevent="item.to && handleNavClick(item.to)"
            >
              <i :class="[item.icon, 'w-4']"></i>
              <span class="flex-1">{{ item.label }}</span>
              <span v-if="item.badge && item.badge > 0" class="px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full min-w-[20px] text-center">{{ item.badge }}</span>
            </a>
          </template>
        </nav>
      </aside>

      <!-- 主内容 -->
      <main class="flex-1 lg:ml-56 p-4 md:p-6 min-h-[calc(100vh-3.5rem)]">
        <slot />
      </main>
    </div>

    <!-- Toast 通知 -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import type { PendingCounts } from '~/types/api'

// 检查管理员权限
const { data: session, status } = useAuth()
const siteName = useSiteName()
const isAdmin = computed(() => (session.value as any)?.role === 'ADMIN')

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})


// 移动端侧边栏状态
const showMobileSidebar = ref(false)

// 路由变化时关闭侧边栏
const route = useRoute()
const router = useRouter()
const frontendReturnPath = computed(() => {
  const gameEditMatch = route.path.match(/^\/admin\/games\/([^/]+)\/edit$/)
  if (gameEditMatch?.[1]) return `/games/${gameEditMatch[1]}`
  return '/'
})
watch(() => route.path, () => {
  showMobileSidebar.value = false
})

// 获取待审核数量
const { data: pendingCounts } = await useAuthFetch<PendingCounts>('/api/admin/pending-counts')
const editRequestPending = computed(() => pendingCounts.value?.editRequests || 0)
const resourcePending = computed(() => pendingCounts.value?.resources || 0)
const reportPending = computed(() => pendingCounts.value?.reports || 0)
const systemErrorPending = computed(() => pendingCounts.value?.systemErrors || 0)

interface NavItem {
  to?: string
  icon?: string
  label?: string
  exact?: boolean
  badge?: number
  separator?: string
  adminOnly?: boolean
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { to: '/admin', icon: 'fa-solid fa-chart-line', label: '仪表盘', exact: true },
    { separator: '内容管理' },
    { to: '/admin/games', icon: 'fa-solid fa-gamepad', label: '游戏条目' },
    { to: '/admin/companies', icon: 'fa-solid fa-building', label: '会社管理' },
    { to: '/admin/series', icon: 'fa-solid fa-layer-group', label: '系列管理' },
    { to: '/admin/tags', icon: 'fa-solid fa-tags', label: '标签管理' },
    { to: '/admin/resource-types', icon: 'fa-solid fa-download', label: '资源类型', adminOnly: true },
    { to: '/admin/net-disks', icon: 'fa-solid fa-cloud', label: '网盘类型', adminOnly: true },
    { to: '/admin/images', icon: 'fa-solid fa-image', label: '图片管理' },
    { to: '/admin/emoji-packs', icon: 'fa-solid fa-face-smile', label: '表情包管理' },
    { to: '/admin/tools', icon: 'fa-solid fa-wrench', label: '工具管理', adminOnly: true },
    { separator: '用户管理' },
    { to: '/admin/users', icon: 'fa-solid fa-users', label: '用户列表', adminOnly: true },
    { to: '/admin/reports', icon: 'fa-solid fa-flag', label: '举报处理', badge: reportPending.value },
    { to: '/admin/operation-logs', icon: 'fa-solid fa-file-lines', label: '操作日志' },
    { to: '/admin/system-error-logs', icon: 'fa-solid fa-triangle-exclamation', label: '错误日志', badge: systemErrorPending.value, adminOnly: true },
    { separator: '审核管理' },
    { to: '/admin/edit-requests', icon: 'fa-solid fa-pen-to-square', label: '条目修改审核', badge: editRequestPending.value },
    { to: '/admin/resource-reviews', icon: 'fa-solid fa-file-circle-check', label: '资源审核', badge: resourcePending.value },
    { separator: '系统设置', adminOnly: true },
    { to: '/admin/settings', icon: 'fa-solid fa-gear', label: '网站设置', exact: true, adminOnly: true },
    { to: '/admin/navbar', icon: 'fa-solid fa-bars', label: '导航栏设置', adminOnly: true },
    { to: '/admin/announcements', icon: 'fa-solid fa-bullhorn', label: '公告管理', adminOnly: true },
    { to: '/admin/link-whitelist', icon: 'fa-solid fa-shield-halved', label: '链接白名单', adminOnly: true },
    { to: '/admin/indexnow', icon: 'fa-solid fa-bolt', label: 'IndexNow', adminOnly: true },
    { to: '/admin/scheduled-tasks', icon: 'fa-solid fa-clock', label: '计划任务', adminOnly: true },
    { to: '/admin/ads', icon: 'fa-solid fa-rectangle-ad', label: '广告管理', adminOnly: true },
    { to: '/admin/ip-blacklist', icon: 'fa-solid fa-ban', label: 'IP 黑名单', adminOnly: true },
    { to: '/admin/fill-info', icon: 'fa-solid fa-wand-magic-sparkles', label: '批量补全信息', adminOnly: true },
    { to: '/admin/scan-covers', icon: 'fa-solid fa-image', label: '封面扫描', adminOnly: true },
    { to: '/admin/scan-alist', icon: 'fa-solid fa-hard-drive', label: 'Alist 资源扫描', adminOnly: true },
    { to: '/admin/friend-links', icon: 'fa-solid fa-link', label: '友情链接', adminOnly: true },
    { to: '/admin/maintenance', icon: 'fa-solid fa-screwdriver-wrench', label: '系统维护', adminOnly: true },
  ]
  return isAdmin.value ? items : items.filter(item => !item.adminOnly)
})

function isNavActive(item: NavItem): boolean {
  const itemTo = item.to
  if (!itemTo) return false
  if (item.exact) return route.path === itemTo
  if (route.path !== itemTo && !route.path.startsWith(itemTo + '/')) return false
  // 如果有其他导航项的路径更长且也匹配当前路由，则当前项不高亮
  const hasMoreSpecific = navItems.value.some(other =>
    other.to &&
    other.to !== itemTo &&
    other.to.length > itemTo.length &&
    (route.path === other.to || route.path.startsWith(other.to + '/'))
  )
  return !hasMoreSpecific
}

function handleNavClick(to: string) {
  if (route.path === to) return
  router.push(to)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

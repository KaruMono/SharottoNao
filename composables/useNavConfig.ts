export interface NavLink {
  id: string
  label: string
  to: string
  icon: string
  visible: boolean
  isBuiltin: boolean
  requireAuth: boolean
  sortOrder: number
}

export interface IconButton {
  id: string
  label: string
  action: string
  icon: string
  visible: boolean
  isBuiltin: boolean
  requireAuth: boolean
  sortOrder: number
}

export interface FooterLink {
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

export interface NavConfig {
  navLinks: NavLink[]
  iconButtons: IconButton[]
  footerLinks: FooterLink[]
}

export const DEFAULT_NAV_CONFIG: NavConfig = {
  navLinks: [
    { id: 'games', label: '游戏', to: '/games', icon: 'fa-solid fa-gamepad', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 0 },
    { id: 'companies', label: '会社', to: '/companies', icon: 'fa-solid fa-building', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 1 },
    { id: 'tags', label: '标签', to: '/tags', icon: 'fa-solid fa-tags', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 2 },
    { id: 'series', label: '系列', to: '/series', icon: 'fa-solid fa-layer-group', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 3 },
    { id: 'posts', label: '文档', to: '/posts', icon: 'fa-solid fa-book', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 4 },
    { id: 'calendar', label: '日历', to: '/calendar', icon: 'fa-solid fa-calendar-days', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 5 },
    { id: 'leaderboard', label: '贡献', to: '/leaderboard', icon: 'fa-solid fa-trophy', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 6 },
    { id: 'tools', label: '工具', to: '/tools', icon: 'fa-solid fa-wrench', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 7 },
    { id: 'create', label: '创建', to: '/create', icon: 'fa-solid fa-plus', visible: true, isBuiltin: true, requireAuth: true, sortOrder: 8 },
    { id: 'about', label: '关于', to: '/about', icon: 'fa-solid fa-info-circle', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 9 },
  ],
  iconButtons: [
    { id: 'random', label: '随机游戏', action: 'randomGame', icon: 'fa-solid fa-dice', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 0 },
    { id: 'search', label: '搜索', action: 'search', icon: 'fa-solid fa-magnifying-glass', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 1 },
    { id: 'settings', label: '网站设置', action: 'settings', icon: 'fa-solid fa-gear', visible: true, isBuiltin: true, requireAuth: false, sortOrder: 2 },
  ],
  footerLinks: [
    { id: 'github', label: 'GitHub', url: 'https://github.com/KaruMono/Charlotte', icon: 'fa-brands fa-github', visible: true, isBuiltin: true, openInNewTab: true, requireAuth: false, sortOrder: 0 },
  ],
}

export function useNavConfig() {
  return useState<NavConfig>('navConfig', () => DEFAULT_NAV_CONFIG)
}

import prisma from './prisma'

// 缓存设置，避免频繁查询数据库
let settingsCache: Map<string, string> | null = null
let cacheTime: number = 0
let refreshPromise: Promise<void> | null = null
const CACHE_TTL = 60 * 1000 // 1分钟缓存

export async function getSetting(key: string): Promise<string | null> {
  await refreshCacheIfNeeded()
  return settingsCache?.get(key) ?? null
}

export async function getSettings(): Promise<Map<string, string>> {
  await refreshCacheIfNeeded()
  return settingsCache ?? new Map()
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  // 清除缓存
  settingsCache = null
  refreshPromise = null
}

export async function getSettingsObject(): Promise<Record<string, string>> {
  const settings = await getSettings()
  const obj: Record<string, string> = {}
  settings.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

async function refreshCacheIfNeeded() {
  const now = Date.now()
  if (settingsCache && now - cacheTime < CACHE_TTL) {
    return
  }

  // 防止并发时重复查询：复用已存在的 Promise
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const settings = await prisma.setting.findMany()
    settingsCache = new Map(settings.map(s => [s.key, s.value]))
    cacheTime = Date.now()
    refreshPromise = null
  })()

  return refreshPromise
}

export function clearSettingsCache() {
  settingsCache = null
  refreshPromise = null
}

// 获取网站名称
export async function getSiteName(): Promise<string> {
  return (await getSetting('site_name')) ?? 'Charlotte'
}

// 获取网站描述
export async function getSiteDescription(): Promise<string> {
  return (await getSetting('site_description')) ?? 'Galgame 资源数据库'
}

// 获取首页标题（SEO 专用，未设置时返回空字符串）
export async function getHomeTitle(): Promise<string> {
  return (await getSetting('home_title')) ?? ''
}

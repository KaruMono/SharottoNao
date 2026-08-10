<template>
  <NuxtLoadingIndicator color="#6b7280" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// 全局初始化
const { data: session } = useAuth()

// 捕获路由导航取消/中断错误，防止快速点击时白屏
const router = useRouter()
router.onError((err) => {
  if (
    err?.name === 'NavigationCancelled' ||
    err?.name === 'NavigationAborted' ||
    err?.name === 'NavigationDuplicated' ||
    err?.message?.includes('navigation') ||
    err?.message?.includes('cancelled') ||
    err?.message?.includes('aborted')
  ) {
    return
  }
  throw err
})

// 获取站点基本信息 & 导航栏配置（并行请求，避免串行阻塞 SSR）
const siteName = useSiteName()
const navConfig = useNavConfig()
const downloadVisibility = useDownloadVisibility()
const runtimeConfig = useRuntimeConfig()
const buildId = runtimeConfig.public?.buildId as string | undefined
const [{ data: homeInfo }, { data: navData }] = await Promise.all([
  useFetch('/api/site-info', { key: 'site-info' }),
  useFetch('/api/nav-config', { key: `nav-config-${buildId || 'local'}`, query: { v: buildId } }),
])
if (homeInfo.value?.siteName) {
  siteName.value = homeInfo.value.siteName
}
if ((navData.value as any)?.navLinks?.length) {
  navConfig.value = navData.value as any
}
if (homeInfo.value?.downloadVisibility) {
  downloadVisibility.value = homeInfo.value.downloadVisibility
}

// 动态设置 favicon、touch icon、canonical 和自定义 meta 标签
const route = useRoute()
const siteUrl = computed(() => (runtimeConfig.public?.siteUrl as string || '').replace(/\/+$/, ''))

useHead({
  link: computed(() => {
    const links: any[] = []
    const favicon = homeInfo.value?.favicon
    if (favicon) {
      links.push({ rel: 'icon', href: favicon, key: 'favicon' })
    }
    const touchIcon = homeInfo.value?.touchIcon
    if (touchIcon) {
      links.push({ rel: 'apple-touch-icon', href: touchIcon, key: 'touch-icon' })
    }
    if (siteUrl.value) {
      links.push({ rel: 'canonical', href: `${siteUrl.value}${route.path}`, key: 'canonical' })
    }
    return links
  }),
  meta: computed(() => {
    const meta = parseMetaTags(homeInfo.value?.customMetaTags || '')
    const path = route.path
    const hasQuery = Object.keys(route.query).length > 0
    const noindexPaths = ['/search', '/following']
    const noindexPrefixes = ['/tool-download/', '/download/']
    const noindexQueryPrefixes = ['/games', '/tags', '/companies', '/series', '/posts']
    const shouldNoindex =
      noindexPaths.includes(path) ||
      noindexPrefixes.some(prefix => path.startsWith(prefix)) ||
      (hasQuery && noindexQueryPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`)))

    if (shouldNoindex) {
      meta.push({ name: 'robots', content: 'noindex, follow', key: 'robots' })
      meta.push({ name: 'googlebot', content: 'noindex, follow', key: 'googlebot' })
    }

    return meta
  }),
  script: computed(() => {
    const scripts: any[] = []
    if (siteUrl.value && siteName.value) {
      scripts.push({
        type: 'application/ld+json',
        key: 'jsonld-website',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName.value,
          url: siteUrl.value,
          description: homeInfo.value?.siteDescription || '',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${siteUrl.value}/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }),
      })
    }
    // 注入头部自定义脚本（统计代码等）— SSR 直出
    scripts.push(...parseScriptTags(homeInfo.value?.headerScripts || ''))
    return scripts
  }),
  noscript: computed(() => parseNoscriptTags(homeInfo.value?.headerScripts || '')),
})

// 注入底部自定义脚本 — SSR 直出到 </body> 前
useHead({
  script: computed(() =>
    parseScriptTags(homeInfo.value?.footerScripts || '').map(s => ({
      ...s,
      tagPosition: 'bodyClose' as const,
      key: s.key?.replace('custom-script-', 'custom-footer-script-'),
    }))
  ),
  noscript: computed(() =>
    parseNoscriptTags(homeInfo.value?.footerScripts || '').map(s => ({
      ...s,
      tagPosition: 'bodyClose' as const,
      key: s.key?.replace('custom-noscript-', 'custom-footer-noscript-'),
    }))
  ),
})

// 解析 HTML 字符串中的 <script> 标签，转换为 useHead 兼容对象
function parseScriptTags(html: string): Record<string, any>[] {
  if (!html.trim()) return []
  const result: Record<string, any>[] = []
  const scriptRegex = /<script(\s[^>]*)?>([^]*?)<\/script>/gi
  let match
  let idx = 0
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrStr = match[1] || ''
    const content = match[2] || ''
    const attrs: Record<string, any> = { key: `custom-script-${idx++}` }
    // 解析属性
    const attrRegex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      const name = attrMatch[1]
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? true
      attrs[name] = value
    }
    if (content.trim()) {
      attrs.innerHTML = content
    }
    result.push(attrs)
  }
  return result
}

// 解析 HTML 字符串中的 <noscript> 标签
function parseNoscriptTags(html: string): Record<string, any>[] {
  if (!html.trim()) return []
  const result: Record<string, any>[] = []
  const noscriptRegex = /<noscript[^>]*>([^]*?)<\/noscript>/gi
  let match
  let idx = 0
  while ((match = noscriptRegex.exec(html)) !== null) {
    result.push({ key: `custom-noscript-${idx++}`, innerHTML: match[1] })
  }
  return result
}

// 解析自定义 meta 标签 HTML 字符串，提取属性对象数组
function parseMetaTags(html: string): Record<string, string>[] {
  if (!html.trim()) return []
  const result: Record<string, string>[] = []
  const metaRegex = /<meta\s+([^>]*?)\/?>|<meta\s+([^>]*?)>/gi
  let match
  while ((match = metaRegex.exec(html)) !== null) {
    const attrStr = match[1] || match[2]
    const attrs: Record<string, string> = {}
    const attrRegex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      const name = attrMatch[1]
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ''
      attrs[name] = value
    }
    if (Object.keys(attrs).length) result.push(attrs)
  }
  return result
}

// 全局自定义代码：将 footer_html 和 favicon 存入全局状态供 layout 使用
const customFooterHtml = useState<string>('customFooterHtml', () => '')
const favicon = useState<string>('favicon', () => '')
const siteSettings = useState<Record<string, string>>('siteSettings', () => ({}))

if (homeInfo.value?.footerHtml) {
  customFooterHtml.value = homeInfo.value.footerHtml
}
if (homeInfo.value?.favicon) {
  favicon.value = homeInfo.value.favicon
}

siteSettings.value = {
  cdn_type: homeInfo.value?.cdnType || 'none',
  cdn_url: homeInfo.value?.cdnUrl || '',
  gravatar_cdn: homeInfo.value?.gravatarCdn || 'default',
  gravatar_cdn_url: homeInfo.value?.gravatarCdnUrl || '',
}

// 剧透文本点击显示
function handleSpoilerClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('spoiler')) {
    target.classList.toggle('revealed')
  }
}

onMounted(() => {
  document.addEventListener('click', handleSpoilerClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleSpoilerClick)
})
</script>

<style>
/* 深色模式下 body 文本颜色 — 确保 Teleport 到 body 的弹窗继承正确的文字颜色 */
.dark body {
  color: #f3f4f6; /* gray-100 */
}

/* ===================== 页面切换动画 ===================== */
.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease;
  will-change: transform, opacity;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.page-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.page-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* ===================== Tab / 选项切换动画 ===================== */
.tab-enter-active,
.tab-leave-active {
  transition: all 0.2s ease;
}
.tab-enter-from,
.tab-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ===================== 淡入动画 ===================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* ===================== 下拉展开动画 ===================== */
.dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
  transform-origin: top;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.92) translateY(-4px);
}

/* 统一弹窗动画 */
.modal-enter-active {
  animation: modal-bg-in 0.25s ease-out;
}
.modal-leave-active {
  animation: modal-bg-out 0.2s ease-in forwards;
}
@keyframes modal-bg-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modal-bg-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
.modal-enter-active .modal-content {
  animation: modal-content-in 0.25s ease-out;
}
.modal-leave-active .modal-content {
  animation: modal-content-out 0.2s ease-in forwards;
}
@keyframes modal-content-in {
  from { opacity: 0; transform: scale(0.9) translateY(-20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modal-content-out {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.9) translateY(-20px); }
}

/* 全局剧透文本样式 */
.spoiler {
  background-color: #1f2937;
  color: #1f2937;
  border-radius: 2px;
  padding: 0 2px;
  cursor: pointer;
  transition: all 0.2s;
}

.dark .spoiler {
  background-color: #d4d4d8;
  color: #d4d4d8;
}

.spoiler:hover,
.spoiler.revealed {
  background-color: #f3f4f6;
  color: #1f2937;
}

.dark .spoiler:hover,
.dark .spoiler.revealed {
  background-color: #3f3f46;
  color: #e4e4e7;
}

/* 美化全局 checkbox */
input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 1.125rem;
  height: 1.125rem;
  border: 2px solid #d1d5db;
  border-radius: 0.25rem;
  background-color: #fff;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background-color 0.15s, border-color 0.15s;
}

input[type="checkbox"]:checked {
  background-color: #374151;
  border-color: #374151;
}

input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

input[type="checkbox"]:focus-visible {
  outline: 2px solid #6b7280;
  outline-offset: 2px;
}

.dark input[type="checkbox"] {
  background-color: #3f3f46;
  border-color: #52525b;
}

.dark input[type="checkbox"]:checked {
  background-color: #52525b;
  border-color: #52525b;
}

/* 隐藏的 checkbox 不受影响 */
input[type="checkbox"].hidden {
  -webkit-appearance: none;
  appearance: none;
  width: 0;
  height: 0;
  border: none;
  position: absolute;
}

/* ===================== 全局滚动条美化 ===================== */

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
.dark * {
  scrollbar-color: #52525b transparent;
}

/* Webkit (Chrome / Safari / Edge) — 6px 细条，浮动在内容上方 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}
::-webkit-scrollbar-thumb:active {
  background-color: #6b7280;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* 暗色模式 */
.dark ::-webkit-scrollbar-thumb {
  background-color: #52525b;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background-color: #71717a;
}
.dark ::-webkit-scrollbar-thumb:active {
  background-color: #a1a1aa;
}
</style>

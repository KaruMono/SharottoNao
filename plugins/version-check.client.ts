/**
 * 客户端版本检查插件
 *
 * 每次路由切换时对比本地 buildId 和服务端 buildId，
 * 发现不一致时显示全屏更新提示并自动刷新页面。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const clientBuildId = config.public.buildId as string
  const router = useRouter()

  // 距上次检查的最小间隔（毫秒），避免频繁请求
  const CHECK_INTERVAL = 60 * 1000
  let lastCheckTime = 0

  router.afterEach(async () => {
    const now = Date.now()
    if (now - lastCheckTime < CHECK_INTERVAL) return
    lastCheckTime = now

    try {
      const data = await $fetch<{ buildId: string }>('/api/build-id', {
        // 禁止缓存，确保拿到最新值
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (data.buildId && data.buildId !== clientBuildId) {
        showUpdateOverlay()
      }
    } catch {
      // 网络错误等静默忽略
    }
  })

  // 捕获动态 import 失败（旧 chunk 不存在），自动触发更新
  router.onError((err) => {
    if (
      err?.message?.includes('Failed to fetch dynamically imported module') ||
      err?.message?.includes('Importing a module script failed') ||
      err?.name === 'ChunkLoadError'
    ) {
      showUpdateOverlay()
    }
  })

  // Vue 级别兜底：捕获组件加载失败
  nuxtApp.hook('vue:error', (err: any) => {
    if (
      err?.message?.includes('Failed to fetch dynamically imported module') ||
      err?.message?.includes('Importing a module script failed') ||
      err?.name === 'ChunkLoadError'
    ) {
      showUpdateOverlay()
    }
  })
})

function showUpdateOverlay() {
  // 防止重复创建
  if (document.getElementById('version-update-overlay')) return

  const overlay = document.createElement('div')
  overlay.id = 'version-update-overlay'
  overlay.innerHTML = `
    <div style="
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(255,255,255,0.95);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        width: 40px; height: 40px;
        border: 3px solid #e5e7eb; border-top-color: #374151;
        border-radius: 50%; animation: vu-spin 0.8s linear infinite;
      "></div>
      <div style="font-size: 16px; color: #1f2937; font-weight: 500;">发现新版本，正在更新...</div>
      <div style="font-size: 13px; color: #9ca3af;">正在清理缓存并刷新页面</div>
    </div>
    <style>
      @keyframes vu-spin { to { transform: rotate(360deg); } }
      .dark #version-update-overlay > div { background: rgba(24,24,27,0.95) !important; }
      .dark #version-update-overlay > div > div:nth-child(1) { border-color: #3f3f46 !important; border-top-color: #a1a1aa !important; }
      .dark #version-update-overlay > div > div:nth-child(2) { color: #f4f4f5 !important; }
      .dark #version-update-overlay > div > div:nth-child(3) { color: #71717a !important; }
    </style>
  `
  document.body.appendChild(overlay)

  // 清理缓存后刷新
  setTimeout(async () => {
    try {
      // 清除 CacheStorage（Nuxt payload、预渲染缓存等）
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }

      // 注销所有 Service Worker（如有）
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
      }
    } catch {
      // 清理失败不阻塞刷新
    }

    // 强制无缓存刷新
    window.location.href = window.location.href
  }, 1500)
}

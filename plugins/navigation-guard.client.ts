import { isChunkLoadError, RESOURCE_RECOVERY_EVENT } from '~/utils/resource-recovery'

/**
 * 生产环境数据量较大时，连续路由切换会让慢请求和页面卸载交错。
 * 这里不直接取消导航，而是把过密的点击短暂排队，保持页面区始终有稳定内容。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const origHandler = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err: any, instance, info) => {
    if (isNavigationNoise(err)) return
    if (origHandler) return origHandler(err, instance, info)
    console.error(err)
  }

  const router = useRouter()
  let checkTimer: ReturnType<typeof setTimeout> | null = null
  let lastNavigationStartedAt = 0
  const MIN_NAVIGATION_GAP = 250

  function scheduleBlankScreenCheck(delay = 2200) {
    if (checkTimer) clearTimeout(checkTimer)

    checkTimer = setTimeout(() => {
      const nuxtEl = document.getElementById('__nuxt')
      if (!nuxtEl) return

      const visibleText = nuxtEl.innerText?.trim() || ''
      const hasVisibleContent = visibleText.length > 10 || nuxtEl.querySelectorAll('img, canvas, video, svg').length > 0

      if (!hasVisibleContent) {
        console.warn('[navigation-guard] 检测到白屏，请求受限恢复')
        window.dispatchEvent(new CustomEvent(RESOURCE_RECOVERY_EVENT, {
          detail: { reason: 'blank-screen' },
        }))
      }
    }, delay)
  }

  router.beforeEach(async () => {
    const now = Date.now()
    const elapsed = now - lastNavigationStartedAt

    if (elapsed < MIN_NAVIGATION_GAP) {
      await wait(MIN_NAVIGATION_GAP - elapsed)
    }

    lastNavigationStartedAt = Date.now()
    scheduleBlankScreenCheck(4000)
  })

  router.afterEach(() => {
    scheduleBlankScreenCheck()
  })

  router.onError((error) => {
    if (isChunkLoadError(error)) {
      if (checkTimer) clearTimeout(checkTimer)
      checkTimer = null
      return
    }
    scheduleBlankScreenCheck(1200)
  })
})

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isNavigationNoise(err: any): boolean {
  if (!err) return false
  const name = err?.name || ''
  const message = (err?.message || '').toLowerCase()

  return (
    name === 'NavigationCancelled' ||
    name === 'NavigationAborted' ||
    name === 'NavigationDuplicated' ||
    name === 'NavigationFailure' ||
    message.includes('navigation') ||
    message.includes('cancelled') ||
    message.includes('aborted') ||
    message.includes('the user aborted') ||
    (err instanceof DOMException && err.name === 'AbortError')
  )
}

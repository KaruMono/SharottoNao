import { reloadNuxtApp } from '#app'
import {
  claimResourceRecoveryAttempt,
  isChunkLoadError,
  RESOURCE_RECOVERY_EVENT,
  RESOURCE_RECOVERY_TTL_MS,
  type ResourceRecoveryReason,
} from '~/utils/resource-recovery'

interface BuildIdResponse {
  buildId?: string
}

interface RecoveryRequest {
  reason: ResourceRecoveryReason
  serverBuildId?: string
}

const CHECK_INTERVAL_MS = 60 * 1000
const AUTO_RELOAD_DELAY_MS = 1200

/**
 * Detects deployments and owns every automatic page reload used for resource
 * recovery. Keeping one owner is important: multiple direct reload handlers
 * can bypass each other's cross-page loop protection.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const clientBuildId = String(config.public.buildId || '')
  const router = useRouter()

  let lastCheckTime = 0
  let recoveryState: 'idle' | 'checking' | 'reloading' | 'blocked' = 'idle'

  async function fetchServerBuildId(): Promise<string> {
    const data: any = await $fetch('/api/build-id', {
      query: { t: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      retry: 0,
      timeout: 3000,
    } as any)
    return typeof data?.buildId === 'string' ? data.buildId : ''
  }

  async function checkForNewVersion() {
    const now = Date.now()
    if (now - lastCheckTime < CHECK_INTERVAL_MS) return
    lastCheckTime = now

    try {
      const serverBuildId = await fetchServerBuildId()
      if (serverBuildId && clientBuildId && serverBuildId !== clientBuildId) {
        await requestRecovery({ reason: 'version-mismatch', serverBuildId })
      }
    } catch {
      // A failed version probe is not itself a reason to disrupt the page.
    }
  }

  async function requestRecovery(request: RecoveryRequest) {
    if (recoveryState === 'blocked') {
      if (request.reason !== 'version-mismatch') showRecoveryOverlay('manual', false)
      return
    }
    if (recoveryState !== 'idle') return

    recoveryState = 'checking'
    let serverBuildId = request.serverBuildId || ''
    if (!serverBuildId) {
      try {
        serverBuildId = await fetchServerBuildId()
      } catch {
        // A one-time guarded reload can still recover a transient chunk failure.
      }
    }

    const versionChanged = Boolean(
      serverBuildId && clientBuildId && serverBuildId !== clientBuildId,
    )
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`
    let claim: ReturnType<typeof claimResourceRecoveryAttempt> = { status: 'unavailable' }

    try {
      claim = claimResourceRecoveryAttempt({
        storage: window.sessionStorage,
        path,
        buildId: serverBuildId || clientBuildId,
        reason: versionChanged ? 'version-mismatch' : request.reason,
      })
    } catch {
      // Accessing sessionStorage itself may throw in restricted browser modes.
    }

    if (claim.status !== 'claimed') {
      // Rolling deployments can briefly alternate old/new build IDs across PM2
      // workers. Suppress a repeated passive version prompt, but never hide an
      // actual chunk failure or blank page from the user.
      if (request.reason === 'version-mismatch') {
        recoveryState = 'idle'
        return
      }

      recoveryState = 'blocked'
      showRecoveryOverlay('manual', versionChanged)
      return
    }

    recoveryState = 'reloading'
    window.setTimeout(() => {
      reloadNuxtApp({
        path,
        force: true,
        persistState: true,
        ttl: RESOURCE_RECOVERY_TTL_MS,
      })
    }, AUTO_RELOAD_DELAY_MS)
    showRecoveryOverlay('automatic', versionChanged)
  }

  function handleRecoveryEvent(event: Event) {
    const detail = (event as CustomEvent<{ reason?: ResourceRecoveryReason }>).detail
    const reason = detail?.reason === 'blank-screen' ? 'blank-screen' : 'chunk-error'
    void requestRecovery({ reason })
  }

  nuxtApp.hook('app:chunkError', ({ error }) => {
    void requestRecovery({ reason: 'chunk-error' })
    console.error('[resource-recovery] 页面资源加载失败', error)
  })

  // Fallbacks for browsers and module failures that do not emit app:chunkError.
  router.onError((error) => {
    if (isChunkLoadError(error)) void requestRecovery({ reason: 'chunk-error' })
  })
  nuxtApp.hook('vue:error', (error) => {
    if (isChunkLoadError(error)) void requestRecovery({ reason: 'chunk-error' })
  })

  window.addEventListener(RESOURCE_RECOVERY_EVENT, handleRecoveryEvent)

  nuxtApp.hook('app:mounted', () => {
    void checkForNewVersion()
  })
  router.afterEach(() => {
    void checkForNewVersion()
  })
})

function showRecoveryOverlay(mode: 'automatic' | 'manual', versionChanged: boolean) {
  const existing = document.getElementById('version-update-overlay')
  if (existing) existing.remove()

  const automaticTitle = versionChanged ? '发现新版本，正在更新...' : '页面资源加载失败，正在恢复...'
  const automaticDetail = versionChanged ? '即将重新加载当前页面' : '正在进行一次安全重试'
  const manualTitle = versionChanged ? '新版本资源仍未加载成功' : '页面资源加载失败'

  const overlay = document.createElement('div')
  overlay.id = 'version-update-overlay'
  overlay.setAttribute('role', mode === 'manual' ? 'alertdialog' : 'status')
  overlay.setAttribute('aria-live', 'assertive')
  if (mode === 'manual') overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `
    <div class="vu-panel">
      <div class="vu-spinner" ${mode === 'manual' ? 'hidden' : ''}></div>
      <div class="vu-title">${mode === 'automatic' ? automaticTitle : manualTitle}</div>
      <div class="vu-detail">${mode === 'automatic'
        ? automaticDetail
        : '自动恢复已停止，避免反复刷新。请确认网络恢复后再手动重试。'}</div>
      ${mode === 'manual'
        ? '<div class="vu-actions"><button id="version-update-retry" type="button">重新加载</button><button id="version-update-dismiss" type="button">暂不处理</button></div>'
        : ''}
    </div>
    <style>
      #version-update-overlay {
        position: fixed; inset: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; background: rgba(255,255,255,0.96);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #version-update-overlay .vu-panel {
        display: flex; max-width: 420px; align-items: center; justify-content: center;
        flex-direction: column; gap: 14px; text-align: center;
      }
      #version-update-overlay .vu-spinner {
        width: 40px; height: 40px; box-sizing: border-box;
        border: 3px solid #e5e7eb; border-top-color: #374151;
        border-radius: 50%; animation: vu-spin 0.8s linear infinite;
      }
      #version-update-overlay .vu-title { color: #1f2937; font-size: 16px; font-weight: 600; }
      #version-update-overlay .vu-detail { color: #6b7280; font-size: 13px; line-height: 1.6; }
      #version-update-overlay .vu-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 4px; }
      #version-update-overlay button {
        min-height: 38px; border: 1px solid #d1d5db; border-radius: 8px;
        padding: 8px 16px; background: #fff; color: #374151; cursor: pointer;
        font: inherit; font-size: 14px;
      }
      #version-update-overlay #version-update-retry { border-color: #111827; background: #111827; color: #fff; }
      #version-update-overlay button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
      @keyframes vu-spin { to { transform: rotate(360deg); } }
      .dark #version-update-overlay { background: rgba(24,24,27,0.96); }
      .dark #version-update-overlay .vu-spinner { border-color: #3f3f46; border-top-color: #a1a1aa; }
      .dark #version-update-overlay .vu-title { color: #f4f4f5; }
      .dark #version-update-overlay .vu-detail { color: #a1a1aa; }
      .dark #version-update-overlay button { border-color: #52525b; background: #27272a; color: #e4e4e7; }
      .dark #version-update-overlay #version-update-retry { border-color: #f4f4f5; background: #f4f4f5; color: #18181b; }
    </style>
  `
  document.body.appendChild(overlay)

  if (mode === 'manual') {
    overlay.querySelector<HTMLButtonElement>('#version-update-retry')?.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      button.disabled = true
      button.textContent = '正在重新加载...'
      window.location.reload()
    })
    overlay.querySelector<HTMLButtonElement>('#version-update-dismiss')?.addEventListener('click', () => {
      overlay.remove()
    })
  }
}

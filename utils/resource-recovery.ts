export const RESOURCE_RECOVERY_EVENT = 'charlotte:resource-recovery'
export const RESOURCE_RECOVERY_STORAGE_KEY = 'charlotte:resource-recovery-attempts'
export const RESOURCE_RECOVERY_TTL_MS = 5 * 60 * 1000

const MAX_STORED_ATTEMPTS = 20

export type ResourceRecoveryReason = 'version-mismatch' | 'chunk-error' | 'blank-screen'

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface RecoveryAttempt {
  path: string
  buildId: string
  reason: ResourceRecoveryReason
  attemptedAt: number
  expiresAt: number
}

interface RecoveryState {
  attempts: RecoveryAttempt[]
}

export type RecoveryClaim =
  | { status: 'claimed', expiresAt: number }
  | { status: 'blocked', expiresAt: number }
  | { status: 'unavailable' }

export function claimResourceRecoveryAttempt(input: {
  storage: StorageLike
  path: string
  buildId?: string
  reason: ResourceRecoveryReason
  now?: number
  ttlMs?: number
}): RecoveryClaim {
  const now = input.now ?? Date.now()
  const ttlMs = Number.isFinite(input.ttlMs) && (input.ttlMs ?? 0) > 0
    ? Math.floor(input.ttlMs as number)
    : RESOURCE_RECOVERY_TTL_MS
  const path = input.path || '/'

  try {
    const attempts = readRecoveryState(input.storage.getItem(RESOURCE_RECOVERY_STORAGE_KEY))
      .attempts
      .filter(attempt => attempt.expiresAt > now)

    const buildId = input.buildId || 'unknown'
    // A failed release can affect every route. Keep one automatic retry budget
    // for the whole browser session instead of allowing one reload per path.
    // A reload changes the whole document, not just the route that reported
    // the failure. Keep one automatic budget for the browser session so a
    // rolling deployment cannot cause a reload loop while workers alternate
    // between two build IDs.
    const recentAttempt = attempts[attempts.length - 1]
    if (recentAttempt) {
      return { status: 'blocked', expiresAt: recentAttempt.expiresAt }
    }

    const expiresAt = now + ttlMs
    const nextAttempt: RecoveryAttempt = {
      path,
      buildId,
      reason: input.reason,
      attemptedAt: now,
      expiresAt,
    }
    const nextState: RecoveryState = {
      attempts: [...attempts, nextAttempt]
        .sort((a, b) => a.attemptedAt - b.attemptedAt)
        .slice(-MAX_STORED_ATTEMPTS),
    }

    input.storage.setItem(RESOURCE_RECOVERY_STORAGE_KEY, JSON.stringify(nextState))

    // Some restricted browser modes silently discard storage writes. Automatic
    // reload must fail closed in that case, otherwise no cross-reload guard exists.
    const persisted = readRecoveryState(input.storage.getItem(RESOURCE_RECOVERY_STORAGE_KEY))
    if (!persisted.attempts.some(attempt => attempt.path === path && attempt.expiresAt === expiresAt)) {
      return { status: 'unavailable' }
    }

    return { status: 'claimed', expiresAt }
  } catch {
    return { status: 'unavailable' }
  }
}

export function isChunkLoadError(error: unknown): boolean {
  return inspectChunkLoadError(error, new Set(), 0)
}

/** True for a script/link element whose URL points at a Nuxt core asset. */
export function isCoreResourceTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('tagName' in target)) return false
  const element = target as HTMLElement & { src?: string, href?: string }
  const tagName = element.tagName.toLowerCase()
  if (tagName !== 'script' && tagName !== 'link') return false

  return isNuxtAssetUrl(element.src || element.href || '')
}

/** True for same-origin Nuxt static resources, including images and fonts. */
export function isStaticResourceTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('tagName' in target)) return false
  const element = target as HTMLElement & { src?: string, href?: string }
  const tagName = element.tagName.toLowerCase()
  if (!['script', 'link', 'img', 'source', 'video', 'audio'].includes(tagName)) return false

  return isStaticResourceUrl(element.src || element.href || '')
}

/** Return true when a URL is a same-origin immutable/static asset URL. */
export function isStaticResourceUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false

  try {
    const base = typeof globalThis.location?.href === 'string' ? globalThis.location.href : 'http://localhost/'
    const url = new URL(value, base)
    if (typeof globalThis.location?.origin === 'string' && url.origin !== globalThis.location.origin) {
      return false
    }
    return url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/uploads/')
  } catch {
    return false
  }
}

function isNuxtAssetUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false

  try {
    const base = typeof globalThis.location?.href === 'string' ? globalThis.location.href : 'http://localhost/'
    const url = new URL(value, base)
    if (typeof globalThis.location?.origin === 'string' && url.origin !== globalThis.location.origin) {
      return false
    }
    return url.pathname.startsWith('/_nuxt/')
  } catch {
    return false
  }
}

/** Transport failures that are meaningful when attached to a core resource. */
export function isResourceTransportError(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error ?? '')
  const normalized = message.toLowerCase()
  return normalized.includes('err_http2_protocol_error')
    || normalized.includes('err_http2_stream_error')
    || normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('network error')
    || normalized.includes('connection reset')
    || normalized.includes('socket hang up')
}

function inspectChunkLoadError(error: unknown, seen: Set<unknown>, depth: number): boolean {
  if (error == null || depth > 3 || seen.has(error)) return false
  seen.add(error)

  if (typeof error === 'string') return hasChunkLoadMessage(error)
  if (typeof error !== 'object') return false

  try {
    const candidate = error as { name?: unknown, message?: unknown, cause?: unknown }
    if (candidate.name === 'ChunkLoadError') return true
    if (typeof candidate.message === 'string' && hasChunkLoadMessage(candidate.message)) return true
    return inspectChunkLoadError(candidate.cause, seen, depth + 1)
  } catch {
    return false
  }
}

function hasChunkLoadMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('failed to fetch dynamically imported module')
    || normalized.includes('importing a module script failed')
    || normalized.includes('error loading dynamically imported module')
    || normalized.includes('loading chunk') && normalized.includes('failed')
    || normalized.includes('loading css chunk') && normalized.includes('failed')
    || normalized.includes('unable to preload css')
}

function readRecoveryState(value: string | null): RecoveryState {
  if (!value) return { attempts: [] }

  try {
    const parsed = JSON.parse(value) as { attempts?: unknown }
    if (!Array.isArray(parsed.attempts)) return { attempts: [] }

    return {
      attempts: parsed.attempts.filter(isRecoveryAttempt),
    }
  } catch {
    return { attempts: [] }
  }
}

function isRecoveryAttempt(value: unknown): value is RecoveryAttempt {
  if (!value || typeof value !== 'object') return false
  const attempt = value as Partial<RecoveryAttempt>
  return typeof attempt.path === 'string'
    && typeof attempt.buildId === 'string'
    && isResourceRecoveryReason(attempt.reason)
    && typeof attempt.attemptedAt === 'number'
    && Number.isFinite(attempt.attemptedAt)
    && typeof attempt.expiresAt === 'number'
    && Number.isFinite(attempt.expiresAt)
}

function isResourceRecoveryReason(value: unknown): value is ResourceRecoveryReason {
  return value === 'version-mismatch' || value === 'chunk-error' || value === 'blank-screen'
}

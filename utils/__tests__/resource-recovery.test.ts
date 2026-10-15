import { describe, expect, it } from 'vitest'
import {
  claimResourceRecoveryAttempt,
  isCoreResourceTarget,
  isChunkLoadError,
  isStaticResourceTarget,
  isStaticResourceUrl,
  isResourceTransportError,
  RESOURCE_RECOVERY_STORAGE_KEY,
  type StorageLike,
} from '../resource-recovery'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  discardWrites = false
  throwOnWrite = false

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.throwOnWrite) throw new Error('storage unavailable')
    if (!this.discardWrites) this.values.set(key, value)
  }
}

describe('claimResourceRecoveryAttempt', () => {
  it('allows one automatic recovery for a path', () => {
    const storage = new MemoryStorage()

    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/search?q=ATRI',
      buildId: 'build-a',
      reason: 'chunk-error',
      now: 1_000,
      ttlMs: 5_000,
    })).toEqual({ status: 'claimed', expiresAt: 6_000 })
  })

  it('blocks a second route for the same build after a full-page reload', () => {
    const storage = new MemoryStorage()
    const firstPage = claimResourceRecoveryAttempt({
      storage,
      path: '/search?q=ATRI',
      buildId: 'build-a',
      reason: 'version-mismatch',
      now: 1_000,
      ttlMs: 5_000,
    })

    // A new call represents a fresh JavaScript document after location.reload().
    const reloadedPage = claimResourceRecoveryAttempt({
      storage,
      path: '/games/2',
      buildId: 'build-a',
      reason: 'chunk-error',
      now: 1_100,
      ttlMs: 5_000,
    })

    expect(firstPage.status).toBe('claimed')
    expect(reloadedPage).toEqual({ status: 'blocked', expiresAt: 6_000 })
  })

  it('uses one recovery budget across build IDs', () => {
    const storage = new MemoryStorage()
    claimResourceRecoveryAttempt({
      storage,
      path: '/games/1',
      buildId: 'build-a',
      reason: 'chunk-error',
      now: 1_000,
      ttlMs: 5_000,
    })

    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/games/2',
      buildId: 'build-b',
      reason: 'chunk-error',
      now: 1_100,
      ttlMs: 5_000,
    })).toEqual({ status: 'blocked', expiresAt: 6_000 })
  })

  it('allows another recovery after the guard expires', () => {
    const storage = new MemoryStorage()
    claimResourceRecoveryAttempt({
      storage,
      path: '/games/1',
      reason: 'chunk-error',
      now: 1_000,
      ttlMs: 100,
    })

    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/games/1',
      reason: 'chunk-error',
      now: 1_101,
      ttlMs: 100,
    })).toEqual({ status: 'claimed', expiresAt: 1_201 })
  })

  it('recovers from malformed stored state', () => {
    const storage = new MemoryStorage()
    storage.values.set(RESOURCE_RECOVERY_STORAGE_KEY, '{not-json')

    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/',
      reason: 'blank-screen',
      now: 1_000,
    }).status).toBe('claimed')
  })

  it('fails closed when storage throws or silently discards writes', () => {
    const throwingStorage = new MemoryStorage()
    throwingStorage.throwOnWrite = true
    const discardingStorage = new MemoryStorage()
    discardingStorage.discardWrites = true

    expect(claimResourceRecoveryAttempt({
      storage: throwingStorage,
      path: '/',
      reason: 'chunk-error',
    }).status).toBe('unavailable')
    expect(claimResourceRecoveryAttempt({
      storage: discardingStorage,
      path: '/',
      reason: 'chunk-error',
    }).status).toBe('unavailable')
  })

  it('uses one global budget when the build is unknown during bootstrap', () => {
    const storage = new MemoryStorage()
    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/one',
      buildId: 'bootstrap',
      reason: 'chunk-error',
      now: 1_000,
      ttlMs: 5_000,
    }).status).toBe('claimed')
    expect(claimResourceRecoveryAttempt({
      storage,
      path: '/two',
      buildId: 'build-a',
      reason: 'chunk-error',
      now: 1_100,
      ttlMs: 5_000,
    })).toEqual({ status: 'blocked', expiresAt: 6_000 })
  })
})

describe('isChunkLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: /_nuxt/page.js'),
    new Error('Importing a module script failed.'),
    new Error('error loading dynamically imported module'),
    Object.assign(new Error('Loading chunk 42 failed'), { name: 'ChunkLoadError' }),
    new Error('Loading CSS chunk admin failed'),
    new Error('Unable to preload CSS for /_nuxt/page.css'),
  ])('recognizes browser chunk failures', (error) => {
    expect(isChunkLoadError(error)).toBe(true)
  })

  it('recognizes a wrapped chunk failure', () => {
    expect(isChunkLoadError({
      message: 'Application initialization failed',
      cause: new TypeError('Failed to fetch dynamically imported module'),
    })).toBe(true)
  })

  it.each([
    new TypeError('Failed to fetch'),
    new Error('API request returned 500'),
    new Error('Navigation cancelled'),
    null,
  ])('does not classify ordinary application and network errors', (error) => {
    expect(isChunkLoadError(error)).toBe(false)
  })
})

describe('resource failure classifiers', () => {
  it('recognizes Nuxt core script and stylesheet targets only', () => {
    expect(isCoreResourceTarget({ tagName: 'SCRIPT', src: '/_nuxt/entry.js' } as unknown as EventTarget)).toBe(true)
    expect(isCoreResourceTarget({ tagName: 'LINK', href: '/_nuxt/app.css' } as unknown as EventTarget)).toBe(true)
    expect(isCoreResourceTarget({ tagName: 'IMG', src: '/_nuxt/image.webp' } as unknown as EventTarget)).toBe(false)
    expect(isCoreResourceTarget({ tagName: 'SCRIPT', src: '/api/data' } as unknown as EventTarget)).toBe(false)
  })

  it('recognizes same-origin static assets but excludes external resources', () => {
    expect(isStaticResourceTarget({ tagName: 'IMG', src: '/uploads/cover.webp' } as unknown as EventTarget)).toBe(true)
    expect(isStaticResourceTarget({ tagName: 'SOURCE', src: '/_nuxt/video.mp4' } as unknown as EventTarget)).toBe(true)
    expect(isStaticResourceTarget({ tagName: 'IMG', src: 'https://cdn.example.com/cover.webp' } as unknown as EventTarget)).toBe(false)
    expect(isStaticResourceUrl('/_nuxt/app.js')).toBe(true)
    expect(isStaticResourceUrl('/api/data')).toBe(false)
  })

  it.each([
    new Error('net::ERR_HTTP2_PROTOCOL_ERROR'),
    new TypeError('Failed to fetch'),
    new Error('NetworkError when attempting to fetch resource'),
  ])('recognizes transport failures: %s', (error) => {
    expect(isResourceTransportError(error)).toBe(true)
  })

  it('does not classify ordinary application errors as transport failures', () => {
    expect(isResourceTransportError(new Error('API request returned 500'))).toBe(false)
  })
})

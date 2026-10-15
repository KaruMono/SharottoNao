import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getRedisClient } from './redis'

export interface DistributedLockResult<T> {
  acquired: boolean
  value?: T
}

interface LockOptions {
  ttlMs?: number
  lockDir?: string
}

const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * Run a short maintenance task on one process across PM2 workers/releases.
 * Redis is preferred; a shared atomic lock file is the fallback for installs
 * that do not configure Redis. A skipped lock is reported to the caller so a
 * scheduler can quietly leave the work to the current lock owner.
 */
export async function withDistributedLock<T>(
  name: string,
  task: () => Promise<T>,
  options: LockOptions = {},
): Promise<DistributedLockResult<T>> {
  const ttlMs = normalizeTtl(options.ttlMs)
  const token = randomUUID()
  const redis = await getRedisClient().catch(() => null)

  if (redis?.isOpen) {
    const key = `charlotte:lock:${sanitizeName(name)}`
    try {
      const acquired = await redis.set(key, token, { NX: true, PX: ttlMs })
      if (acquired !== 'OK') return { acquired: false }

      try {
        return { acquired: true, value: await task() }
      } finally {
        await releaseRedisLock(redis, key, token)
      }
    } catch (error) {
      console.warn(`[distributed-lock] Redis lock unavailable for ${name}; using file lock`, error)
    }
  }

  return withFileLock(name, token, task, ttlMs, options.lockDir)
}

async function withFileLock<T>(
  name: string,
  token: string,
  task: () => Promise<T>,
  ttlMs: number,
  configuredDir?: string,
): Promise<DistributedLockResult<T>> {
  const config = useRuntimeConfig()
  const configured = configuredDir || String(config.distributedLockDir || '').trim()
  const lockDir = resolve(configured || join(process.cwd(), '.charlotte-locks'))
  const lockPath = join(lockDir, `${sanitizeName(name)}.lock`)
  await mkdir(lockDir, { recursive: true })

  let handle
  try {
    handle = await open(lockPath, 'wx')
  } catch (error: any) {
    if (error?.code !== 'EEXIST') throw error
    if (await removeStaleLock(lockPath, ttlMs)) {
      try {
        handle = await open(lockPath, 'wx')
      } catch (retryError: any) {
        if (retryError?.code === 'EEXIST') return { acquired: false }
        throw retryError
      }
    } else {
      return { acquired: false }
    }
  }

  try {
    await handle.writeFile(JSON.stringify({ token, createdAt: Date.now() }), 'utf8')
    return { acquired: true, value: await task() }
  } finally {
    await handle.close().catch(() => undefined)
    await removeOwnedLock(lockPath, token)
  }
}

async function removeStaleLock(lockPath: string, ttlMs: number): Promise<boolean> {
  try {
    const details = await stat(lockPath)
    if (Date.now() - details.mtimeMs <= ttlMs) return false
    await unlink(lockPath)
    return true
  } catch (error: any) {
    // A competing process may have removed the stale lock first.
    return error?.code === 'ENOENT'
  }
}

async function removeOwnedLock(lockPath: string, token: string): Promise<void> {
  try {
    const content = JSON.parse(await readFile(lockPath, 'utf8')) as { token?: string }
    if (content.token === token) await unlink(lockPath)
  } catch {
    // Cleanup is best effort; a later invocation will remove stale locks.
  }
}

async function releaseRedisLock(redis: any, key: string, token: string): Promise<void> {
  try {
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      { keys: [key], arguments: [token] },
    )
  } catch {
    // TTL remains as a recovery mechanism if the process exits during release.
  }
}

function sanitizeName(name: string): string {
  const normalized = name.trim().replace(/[^A-Za-z0-9_.-]+/g, '-')
  return normalized || 'unnamed'
}

function normalizeTtl(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) < 1_000) return DEFAULT_TTL_MS
  return Math.floor(value as number)
}

import { H3Event } from 'h3'
import { getRedisClient } from './redis'

interface RateLimitOptions {
  /** 时间窗口（秒） */
  windowSeconds: number
  /** 最大请求数 */
  maxRequests: number
  /** 限流键前缀 */
  keyPrefix: string
}

// ==================== 内存 fallback ====================
// Redis 不可用时使用内存限流，防止完全无保护
const memoryStore = new Map<string, { count: number; expiresAt: number }>()

// 每 5 分钟清理过期条目，防止内存泄漏
// 使用 unref() 确保定时器不阻止进程退出（如 build 预渲染阶段）
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, val] of memoryStore) {
    if (now > val.expiresAt) memoryStore.delete(key)
  }
}, 5 * 60 * 1000)
if (cleanupTimer.unref) cleanupTimer.unref()

function memoryRateLimit(identifier: string, options: RateLimitOptions): boolean {
  const key = `${options.keyPrefix}:${identifier}`
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.expiresAt) {
    memoryStore.set(key, { count: 1, expiresAt: now + options.windowSeconds * 1000 })
    return false
  }

  entry.count++
  return entry.count > options.maxRequests
}

/**
 * 频率限制（优先 Redis，降级内存）
 * @returns true 表示被限流，false 表示放行
 */
export async function isRateLimited(
  event: H3Event,
  identifier: string,
  options: RateLimitOptions
): Promise<boolean> {
  const redis = await getRedisClient()

  if (!redis) {
    return memoryRateLimit(identifier, options)
  }

  const key = `ratelimit:${options.keyPrefix}:${identifier}`

  try {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, options.windowSeconds)
    }
    return current > options.maxRequests
  } catch (error) {
    console.error('Rate limit error:', error)
    return memoryRateLimit(identifier, options)
  }
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIp(event: H3Event): string {
  const config = useRuntimeConfig()

  if (config.trustProxy) {
    const forwarded = getHeader(event, 'x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const realIp = getHeader(event, 'x-real-ip')
    if (realIp) return realIp.trim()
  }

  const addr = event.node.req.socket.remoteAddress || 'unknown'
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr
}

/**
 * 登录频率限制检查
 * IP 限制：每 15 分钟最多 10 次
 * 账号限制：每 15 分钟最多 5 次
 */
export async function checkLoginRateLimit(event: H3Event, email: string): Promise<void> {
  const ip = getClientIp(event)

  const ipLimited = await isRateLimited(event, ip, {
    windowSeconds: 900,
    maxRequests: 10,
    keyPrefix: 'login:ip',
  })

  if (ipLimited) {
    throw createError({
      statusCode: 429,
      message: '登录尝试次数过多，请 15 分钟后再试',
    })
  }

  const accountLimited = await isRateLimited(event, email, {
    windowSeconds: 900,
    maxRequests: 5,
    keyPrefix: 'login:account',
  })

  if (accountLimited) {
    throw createError({
      statusCode: 429,
      message: '该账号登录尝试次数过多，请 15 分钟后再试',
    })
  }
}

/**
 * 注册频率限制检查
 * IP 限制：每小时最多 3 次
 */
export async function checkRegisterRateLimit(event: H3Event): Promise<void> {
  const ip = getClientIp(event)

  const limited = await isRateLimited(event, ip, {
    windowSeconds: 3600,
    maxRequests: 3,
    keyPrefix: 'register:ip',
  })

  if (limited) {
    throw createError({
      statusCode: 429,
      message: '注册请求过于频繁，请稍后再试',
    })
  }
}

/**
 * 验证码发送频率限制
 * IP 限制：每 15 分钟最多 5 次
 */
export async function checkSendCodeRateLimit(event: H3Event): Promise<void> {
  const ip = getClientIp(event)

  const limited = await isRateLimited(event, ip, {
    windowSeconds: 900,
    maxRequests: 5,
    keyPrefix: 'sendcode:ip',
  })

  if (limited) {
    throw createError({
      statusCode: 429,
      message: '验证码请求过于频繁，请稍后再试',
    })
  }
}

/**
 * 密码重置频率限制
 * IP 限制：每 15 分钟最多 5 次
 * 邮箱限制：每 15 分钟最多 3 次
 */
export async function checkResetPasswordRateLimit(event: H3Event, email: string): Promise<void> {
  const ip = getClientIp(event)

  const ipLimited = await isRateLimited(event, ip, {
    windowSeconds: 900,
    maxRequests: 5,
    keyPrefix: 'reset:ip',
  })

  if (ipLimited) {
    throw createError({
      statusCode: 429,
      message: '重置密码请求过于频繁，请稍后再试',
    })
  }

  const emailLimited = await isRateLimited(event, email, {
    windowSeconds: 900,
    maxRequests: 3,
    keyPrefix: 'reset:email',
  })

  if (emailLimited) {
    throw createError({
      statusCode: 429,
      message: '该邮箱重置密码请求过于频繁，请稍后再试',
    })
  }
}

/**
 * 图片上传频率限制
 * 用户限制：每分钟最多 10 张
 */
export async function checkUploadRateLimit(event: H3Event, userId: number): Promise<void> {
  const limited = await isRateLimited(event, String(userId), {
    windowSeconds: 60,
    maxRequests: 10,
    keyPrefix: 'upload:user',
  })

  if (limited) {
    throw createError({
      statusCode: 429,
      message: '上传过于频繁，请稍后再试',
    })
  }
}

/**
 * 评论/攻略等写入频率限制
 * 用户限制：每分钟最多 5 次
 */
export async function checkWriteRateLimit(event: H3Event, userId: number): Promise<void> {
  const limited = await isRateLimited(event, String(userId), {
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix: 'write:user',
  })

  if (limited) {
    throw createError({
      statusCode: 429,
      message: '操作过于频繁，请稍后再试',
    })
  }
}

/**
 * 外部服务代理频率限制
 * 用户限制：每分钟最多 5 次
 */
export async function checkExternalApiRateLimit(event: H3Event, userId: number, keyPrefix = 'external:user'): Promise<void> {
  const limited = await isRateLimited(event, String(userId), {
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix,
  })

  if (limited) {
    throw createError({
      statusCode: 429,
      message: '请求过于频繁，请稍后再试',
    })
  }
}

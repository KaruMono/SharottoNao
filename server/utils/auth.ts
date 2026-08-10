import { H3Event } from 'h3'
import jwt from 'jsonwebtoken'
import prisma from './prisma'
import { getRedisClient } from './redis'
import type { User, UserRole } from '@prisma/client'

interface JWTPayload {
  userId: number
  email: string
  role: UserRole
  /** Token 版本号，用于实现 token 失效 */
  tokenVersion?: number
}

export function generateToken(user: User): string {
  const config = useRuntimeConfig()
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: (user as any).tokenVersion ?? 0,
  }
  return jwt.sign(payload, config.authSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.authSecret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * 使某用户的所有 token 失效（通过 Redis 记录版本号）
 * 在修改密码、角色变更、封禁时调用
 */
export async function invalidateUserTokens(userId: number): Promise<void> {
  const redis = await getRedisClient()
  if (!redis) return

  try {
    const key = `token_version:${userId}`
    await redis.incr(key)
    // 设置过期时间为 token 最长有效期（7 天）+ 缓冲
    await redis.expire(key, 8 * 24 * 3600)
  } catch (error) {
    console.error('Invalidate tokens error:', error)
  }
}

/**
 * 检查 token 版本号是否有效
 */
async function isTokenVersionValid(userId: number, tokenVersion?: number): Promise<boolean> {
  const redis = await getRedisClient()
  if (!redis) return true // Redis 不可用时不检查版本

  try {
    const key = `token_version:${userId}`
    const currentVersion = await redis.get(key)
    if (!currentVersion) return true // 从未失效过，直接通过
    return (tokenVersion ?? 0) >= parseInt(currentVersion)
  } catch {
    return true // 出错时放行
  }
}

// 使用 WeakMap 缓存请求级别的用户信息，避免同一请求多次查询数据库
const userCache = new WeakMap<H3Event, User | null | Promise<User | null>>()

export async function getAuthUser(event: H3Event): Promise<User | null> {
  // 检查缓存
  const cached = userCache.get(event)
  if (cached !== undefined) {
    return cached
  }

  // 创建 Promise 并立即缓存，防止并发请求
  const userPromise = (async () => {
    const authHeader = getHeader(event, 'Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (!payload) {
      return null
    }

    // 检查 token 版本号是否有效
    const versionValid = await isTokenVersionValid(payload.userId, payload.tokenVersion)
    if (!versionValid) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user || user.status === 'BANNED') {
      return null
    }

    return user
  })()

  userCache.set(event, userPromise)
  
  const user = await userPromise
  userCache.set(event, user) // 替换 Promise 为实际结果
  
  return user
}

export async function requireAuth(event: H3Event): Promise<User> {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '请先登录',
    })
  }
  return user
}

export async function requireRole(event: H3Event, roles: UserRole[]): Promise<User> {
  const user = await requireAuth(event)
  if (!roles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '权限不足',
    })
  }
  return user
}

export async function requireAdmin(event: H3Event): Promise<User> {
  return requireRole(event, ['ADMIN'])
}

export async function requireEditor(event: H3Event): Promise<User> {
  return requireRole(event, ['ADMIN', 'EDITOR'])
}

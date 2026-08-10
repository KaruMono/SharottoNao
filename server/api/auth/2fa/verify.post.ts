import { createHash } from 'node:crypto'
import { z } from 'zod'
import { verifySync } from 'otplib'
import jwt from 'jsonwebtoken'
import prisma from '~/server/utils/prisma'
import { generateToken } from '~/server/utils/auth'
import { checkLoginRateLimit, getClientIp } from '~/server/utils/rate-limit'
import { resolveAvatar } from '~/server/utils/gravatar'
import { getRedisClient } from '~/server/utils/redis'

const schema = z.object({
  tempToken: z.string().min(1, '临时 token 不能为空'),
  code: z.string().length(6, '请输入6位验证码'),
})

interface TempTokenPayload {
  userId: number
  type: '2fa_temp'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { tempToken, code } = schema.parse(body)

  await checkLoginRateLimit(event, tempToken)

  const config = useRuntimeConfig()

  let payload: TempTokenPayload
  try {
    payload = jwt.verify(tempToken, config.authSecret) as TempTokenPayload
  } catch {
    throw createError({
      statusCode: 401,
      message: '临时 token 已过期或无效，请重新登录',
    })
  }

  if (payload.type !== '2fa_temp') {
    throw createError({
      statusCode: 401,
      message: '无效的 token 类型',
    })
  }

  // 检查 tempToken 是否已被使用（一次性黑名单，Redis 不可用时降级放行）
  const blacklistKey = `2fa_temp_used:${createHash('sha256').update(tempToken).digest('hex')}`
  const redis = await getRedisClient()
  if (redis) {
    let used: string | null = null
    try {
      used = await redis.get(blacklistKey)
    } catch (error) {
      console.error('Check 2FA temp token blacklist error:', error)
    }
    if (used) {
      throw createError({
        statusCode: 401,
        message: '临时 token 已被使用，请重新登录',
      })
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw createError({
      statusCode: 401,
      message: '用户状态异常',
    })
  }

  if (user.status === 'BANNED') {
    throw createError({
      statusCode: 403,
      message: '账户已被封禁',
    })
  }

  const isValid = verifySync({
    token: code,
    secret: user.twoFactorSecret,
  })

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: '验证码无效或已过期',
    })
  }

  // 验证成功后将 tempToken 写入一次性黑名单，防止有效期内重复使用（TTL 与 token 有效期一致）
  if (redis) {
    try {
      await redis.setEx(blacklistKey, 5 * 60, '1')
    } catch (error) {
      console.error('Set 2FA temp token blacklist error:', error)
    }
  }

  const token = generateToken(user)

  // 更新登录 IP 历史和最后登录时间
  const ip = getClientIp(event)
  const updatedLoginIps = [ip, ...user.loginIps.filter((i: string) => i !== ip)].slice(0, 5)
  prisma.user.update({
    where: { id: user.id },
    data: { loginIps: updatedLoginIps, lastLoginAt: new Date() },
  }).catch(() => {})

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: await resolveAvatar(user.avatar, user.email),
      role: user.role,
      nsfwMode: user.nsfwMode,
    },
  }
})

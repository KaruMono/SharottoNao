import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '~/server/utils/prisma'
import { generateToken } from '~/server/utils/auth'
import { checkLoginRateLimit, getClientIp } from '~/server/utils/rate-limit'
import { resolveAvatar } from '~/server/utils/gravatar'

const schema = z.object({
  // 登录账号同时支持邮箱和用户名；邮箱仍统一转小写，用户名保留原样交给大小写不敏感查询。
  account: z.string().min(1, '请输入邮箱或用户名').max(255),
  password: z.string().min(1, '请输入密码'),
})

// 用户不存在时用于 dummy 比对的固定 hash，避免通过响应时间差枚举邮箱
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', 10)

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { account, password } = schema.parse({ account: body?.account ?? body?.email, password: body?.password })
  const normalizedAccount = account.trim()
  const email = normalizedAccount.toLowerCase()

  // 登录频率限制
  await checkLoginRateLimit(event, email)

  // 查找用户
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username: { equals: normalizedAccount, mode: 'insensitive' } },
      ],
    },
  })

  if (!user) {
    // 执行一次 dummy 比对，保持与正常流程一致的耗时
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    throw createError({
      statusCode: 401,
      message: '邮箱或密码错误',
    })
  }

  // 检查用户状态
  if (user.status === 'BANNED') {
    throw createError({
      statusCode: 403,
      message: '账户已被封禁',
    })
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: '邮箱或密码错误',
    })
  }

  // 若启用了 2FA，返回临时 token 让前端进入第二步验证
  if (user.twoFactorEnabled) {
    const config = useRuntimeConfig()
    const tempToken = jwt.sign(
      { userId: user.id, type: '2fa_temp' },
      config.authSecret,
      { expiresIn: '5m' },
    )
    return {
      needsTwoFactor: true,
      tempToken,
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

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '~/server/utils/prisma'
import { invalidateUserTokens } from '~/server/utils/auth'
import { checkResetPasswordRateLimit } from '~/server/utils/rate-limit'

const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址').transform(v => v.toLowerCase()),
  code: z.string().min(1, '请输入验证码'),
  password: z.string().min(8, '密码至少8位').regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, code, password } = schema.parse(body)

  await checkResetPasswordRateLimit(event, email)

  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    throw createError({
      statusCode: 400,
      message: '该邮箱未注册',
    })
  }

  // 验证验证码
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      code,
      type: 'RESET_PASSWORD',
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!verificationCode) {
    throw createError({
      statusCode: 400,
      message: '验证码无效或已过期',
    })
  }

  // 加密新密码
  const hashedPassword = await bcrypt.hash(password, 10)

  // 更新密码并增加 tokenVersion 使旧 token 失效
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
  })

  // 使所有旧 token 失效（用户需要重新登录）
  await invalidateUserTokens(user.id)

  // 删除已使用的验证码
  await prisma.verificationCode.deleteMany({
    where: {
      email,
      type: 'RESET_PASSWORD',
    },
  })

  return { success: true, message: '密码重置成功' }
})

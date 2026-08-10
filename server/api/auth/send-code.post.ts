import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { generateVerificationCode } from '~/server/utils/storage'
import { sendVerificationEmail, sendPasswordResetEmail } from '~/server/utils/mail'
import { checkSendCodeRateLimit } from '~/server/utils/rate-limit'

const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址').transform(v => v.toLowerCase()),
  type: z.enum(['REGISTER', 'RESET_PASSWORD']),
})

export default defineEventHandler(async (event) => {
  await checkSendCodeRateLimit(event)

  const body = await readBody(event)
  const { email, type } = schema.parse(body)


  // 检查邮箱是否已存在（注册时）
  if (type === 'REGISTER') {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      throw createError({
        statusCode: 400,
        message: '该邮箱已被注册',
      })
    }
  }

  // 检查邮箱是否存在（重置密码时）
  if (type === 'RESET_PASSWORD') {
    const user = await prisma.user.findUnique({
      where: { email },
    })
    if (!user) {
      throw createError({
        statusCode: 400,
        message: '该邮箱未注册',
      })
    }
  }

  // 检查是否频繁发送
  const recentCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      type,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000), // 1分钟内
      },
    },
  })

  if (recentCode) {
    throw createError({
      statusCode: 429,
      message: '请求过于频繁，请稍后再试',
    })
  }

  // 生成验证码
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15分钟后过期

  // 删除该邮箱同类型的旧验证码，防止多个有效验证码同时存在
  await prisma.verificationCode.deleteMany({
    where: { email, type },
  })

  // 保存验证码
  await prisma.verificationCode.create({
    data: {
      email,
      code,
      type,
      expiresAt,
    },
  })

  // 发送邮件
  try {
    if (type === 'REGISTER') {
      await sendVerificationEmail(email, code)
    } else {
      await sendPasswordResetEmail(email, code)
    }
  } catch (error) {
    console.error('发送邮件失败:', error)
    throw createError({
      statusCode: 500,
      message: '发送邮件失败，请稍后再试',
    })
  }

  return { success: true, message: '验证码已发送' }
})

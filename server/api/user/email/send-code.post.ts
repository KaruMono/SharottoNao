import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sendVerificationEmail } from '~/server/utils/mail'
import { generateVerificationCode } from '~/server/utils/storage'

const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址').transform(v => v.toLowerCase()),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { email } = schema.parse(body)

  // 检查邮箱是否已被使用
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser && existingUser.id !== user.id) {
    throw createError({
      statusCode: 400,
      message: '该邮箱已被其他用户使用',
    })
  }

  // 检查是否频繁发送（1分钟内）
  const recentCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      type: 'CHANGE_EMAIL',
      createdAt: { gte: new Date(Date.now() - 60 * 1000) },
    },
  })

  if (recentCode) {
    throw createError({
      statusCode: 429,
      message: '请求过于频繁，请稍后再试',
    })
  }

  // 生成密码学安全的验证码
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  // 存入数据库
  await prisma.verificationCode.create({
    data: {
      email,
      code,
      type: 'CHANGE_EMAIL',
      expiresAt,
    },
  })

  // 发送验证邮件
  try {
    await sendVerificationEmail(email, code)
  } catch (err: any) {
    console.error(`[Email Code] Failed to send to ${email}:`, err?.message || err)
    throw createError({
      statusCode: 500,
      message: '验证码发送失败，请稍后重试',
    })
  }

  return { success: true }
})

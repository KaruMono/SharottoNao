import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  email: z.string().email('请输入有效的邮箱地址').transform(v => v.toLowerCase()),
  code: z.string().length(6, '验证码为6位数字'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { email, code } = schema.parse(body)

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

  // 从数据库验证验证码
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      code,
      type: 'CHANGE_EMAIL',
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!verificationCode) {
    throw createError({
      statusCode: 400,
      message: '验证码无效或已过期',
    })
  }

  // 更新邮箱
  await prisma.user.update({
    where: { id: user.id },
    data: { email },
  })

  // 删除已使用的验证码
  await prisma.verificationCode.deleteMany({
    where: { email, type: 'CHANGE_EMAIL' },
  })

  return { success: true }
})

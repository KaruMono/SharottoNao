import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string()
    .min(8, '新密码至少8位')
    .regex(/[a-zA-Z]/, '密码必须包含字母')
    .regex(/[0-9]/, '密码必须包含数字'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { currentPassword, newPassword } = schema.parse(body)

  // 获取用户当前密码
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  })

  if (!dbUser) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  // 验证当前密码
  const isValid = await bcrypt.compare(currentPassword, dbUser.password)
  if (!isValid) {
    throw createError({
      statusCode: 400,
      message: '当前密码错误',
    })
  }

  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  // 更新密码并递增 token 版本号
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
  })

  // 使所有旧 token 失效（用户需要重新登录）
  await invalidateUserTokens(user.id)

  return { success: true }
})

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  password: z.string().min(1, '请输入当前密码'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  if (!user.twoFactorEnabled) {
    throw createError({
      statusCode: 400,
      message: '两步验证未启用',
    })
  }

  const body = await readBody(event)
  const { password } = schema.parse(body)

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: '密码错误',
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  })

  return { success: true, message: '两步验证已关闭' }
})

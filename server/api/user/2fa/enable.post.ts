import { z } from 'zod'
import { verifySync } from 'otplib'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  code: z.string().length(6, '请输入6位验证码'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  if (user.twoFactorEnabled) {
    throw createError({
      statusCode: 400,
      message: '两步验证已经启用',
    })
  }

  if (!user.twoFactorSecret) {
    throw createError({
      statusCode: 400,
      message: '请先调用 /api/user/2fa/setup 获取密钥',
    })
  }

  const body = await readBody(event)
  const { code } = schema.parse(body)

  const isValid = verifySync({
    token: code,
    secret: user.twoFactorSecret,
  })

  if (!isValid) {
    throw createError({
      statusCode: 400,
      message: '验证码无效，请检查您的 Authenticator 应用',
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  })

  return { success: true, message: '两步验证已成功启用' }
})

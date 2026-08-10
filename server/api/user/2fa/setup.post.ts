import { generateSecret, generateURI } from 'otplib'
import qrcode from 'qrcode'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  if (user.twoFactorEnabled) {
    throw createError({
      statusCode: 400,
      message: '两步验证已经启用，请先关闭后再重新设置',
    })
  }

  const config = useRuntimeConfig()
  const siteName = config.public?.siteName ? String(config.public.siteName) : 'Charlotte'

  const secret = generateSecret()

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret },
  })

  const otpauth = generateURI({
    issuer: siteName,
    label: user.email,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
  })
  const qrDataUrl = await qrcode.toDataURL(otpauth)

  return {
    secret,
    qrDataUrl,
  }
})

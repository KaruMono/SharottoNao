import crypto from 'crypto'
import type { H3Event } from 'h3'

function sign(text: string, expires: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${text}:${expires}`)
    .digest('hex')
}

/**
 * 验证图片验证码，验证通过后清除 cookie
 * @throws createError 400 若验证码错误或过期
 */
export function verifyCaptcha(event: H3Event, input: string): void {
  const config = useRuntimeConfig()
  const secret = config.authSecret as string

  const token = getCookie(event, 'captcha_token')
  if (!token) {
    throw createError({ statusCode: 400, message: '图片验证码已过期，请刷新后重试' })
  }

  const parts = token.split(':')
  if (parts.length !== 3) {
    throw createError({ statusCode: 400, message: '图片验证码无效' })
  }

  const [text, expiresStr, signature] = parts
  const expires = parseInt(expiresStr)

  if (isNaN(expires) || Date.now() > expires) {
    deleteCookie(event, 'captcha_token')
    throw createError({ statusCode: 400, message: '图片验证码已过期，请刷新后重试' })
  }

  const expected = sign(text, expires, secret)
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw createError({ statusCode: 400, message: '图片验证码无效' })
  }

  if (input.trim().toUpperCase() !== text) {
    throw createError({ statusCode: 400, message: '图片验证码不正确' })
  }

  // 验证通过后立即销毁，防止重放
  deleteCookie(event, 'captcha_token')
}

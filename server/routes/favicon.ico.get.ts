import { getSetting } from '../utils/settings'

export default defineEventHandler(async (event) => {
  const favicon = await getSetting('favicon')

  // 如果没有配置或就是 /favicon.ico 本身（避免死循环），返回 404
  if (!favicon || favicon.trim() === '/favicon.ico') {
    throw createError({ statusCode: 404, message: 'Not Found' })
  }

  return sendRedirect(event, favicon.trim(), 302)
})

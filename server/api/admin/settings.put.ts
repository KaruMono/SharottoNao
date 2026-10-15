import { z } from 'zod'
import { isLoginBackgroundUrl, parseLoginBackgrounds } from '~/utils/login-backgrounds'
import { requireAdmin } from '~/server/utils/auth'
import { setSetting, clearSettingsCache } from '~/server/utils/settings'

const schema = z.record(z.string(), z.string())

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const settings = schema.parse(body)

  if ('login_background_images' in settings) {
    const images = parseLoginBackgrounds(settings.login_background_images)
    if (images.some(url => !isLoginBackgroundUrl(url))) {
      throw createError({ statusCode: 400, message: '登录页背景请填写有效的 HTTP(S) 图片链接或以 / 开头的站内路径，每行一张' })
    }
    settings.login_background_images = images.join('\n')
  }

  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value)
  }

  clearSettingsCache()

  return { success: true, message: '设置已保存' }
})

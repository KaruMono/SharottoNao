import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import { setSetting, clearSettingsCache } from '~/server/utils/settings'

const schema = z.record(z.string(), z.string())

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const settings = schema.parse(body)

  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value)
  }

  clearSettingsCache()

  return { success: true, message: '设置已保存' }
})

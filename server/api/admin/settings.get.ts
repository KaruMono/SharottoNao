import { requireAdmin } from '~/server/utils/auth'
import { getSettingsObject } from '~/server/utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const settings = await getSettingsObject()

  return settings
})

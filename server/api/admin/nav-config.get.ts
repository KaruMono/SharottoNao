import { requireAdmin } from '~/server/utils/auth'
import { getSetting } from '~/server/utils/settings'
import { type NavConfig } from '~/server/utils/nav-config'
import { getMigratedFullNavConfig } from '~/server/utils/nav-ad-migration'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const raw = await getSetting('navbar_config')
  let saved: NavConfig | null = null
  if (raw) {
    try {
      saved = JSON.parse(raw)
    } catch {}
  }

  return getMigratedFullNavConfig(saved)
})

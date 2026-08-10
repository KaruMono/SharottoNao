import { getSetting } from '~/server/utils/settings'
import { getDefaultNavConfig, type NavConfig } from '~/server/utils/nav-config'
import { getMigratedFullNavConfig } from '~/server/utils/nav-ad-migration'

export default defineEventHandler(async () => {
  const raw = await getSetting('navbar_config')
  if (!raw) {
    return getDefaultNavConfig()
  }

  try {
    const saved = JSON.parse(raw) as NavConfig
    const config = await getMigratedFullNavConfig(saved)
    return {
      navLinks: config.navLinks.filter(l => l.visible),
      iconButtons: config.iconButtons.filter(b => b.visible),
      footerLinks: (config.footerLinks ?? []).filter(f => f.visible),
    }
  } catch {
    return getDefaultNavConfig()
  }
})

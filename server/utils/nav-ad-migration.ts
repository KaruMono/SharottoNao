import prisma from '~/server/utils/prisma'
import { clearSettingsCache, setSetting } from '~/server/utils/settings'
import { getFullNavConfig, type NavConfig } from '~/server/utils/nav-config'
import { markImageAsUsed } from '~/server/utils/image'
import { invalidateNavigationAndAdsCache } from '~/server/utils/ad-cache'

const NAV_MENU_AD_SLOT = 'nav_menu'
const LEGACY_NAV_AD_ID_PREFIX = 'custom_img_'

type LegacyNavLink = NavConfig['navLinks'][number] & {
  hoverImage?: string
}

type LegacyNavConfig = Omit<NavConfig, 'navLinks'> & {
  navLinks: LegacyNavLink[]
}

function stripHoverImages(config: LegacyNavConfig): NavConfig {
  return {
    navLinks: config.navLinks
      .filter(link => !isLegacyNavAdLink(link))
      .map(({ hoverImage: _hoverImage, ...link }) => link),
    iconButtons: config.iconButtons ?? [],
    footerLinks: config.footerLinks ?? [],
  }
}

function isLegacyNavAdLink(link: LegacyNavLink) {
  return Boolean(link.hoverImage) || link.id.startsWith(LEGACY_NAV_AD_ID_PREFIX)
}

export function hasLegacyNavAds(config: NavConfig | LegacyNavConfig | null | undefined) {
  return Boolean(config?.navLinks?.some(link => isLegacyNavAdLink(link as LegacyNavLink)))
}

export async function migrateLegacyNavAds(saved: LegacyNavConfig): Promise<NavConfig> {
  const legacyLinks = saved.navLinks.filter(isLegacyNavAdLink)
  if (!legacyLinks.length) return stripHoverImages(saved)

  const now = Date.now()
  for (const [index, link] of legacyLinks.entries()) {
    const imageUrl = link.hoverImage

    const existing = await prisma.advertisement.findFirst({
      where: {
        slot: { in: [NAV_MENU_AD_SLOT, 'home_header_strip'] },
        linkUrl: link.to,
        ...(imageUrl ? { imageUrl } : {}),
      },
      select: { id: true, slot: true },
    })

    if (existing && existing.slot !== NAV_MENU_AD_SLOT) {
      await prisma.advertisement.update({
        where: { id: existing.id },
        data: { slot: NAV_MENU_AD_SLOT },
      })
    } else if (!existing && imageUrl) {
      await prisma.advertisement.create({
        data: {
          name: link.label || '广告',
          slot: NAV_MENU_AD_SLOT,
          imageUrl,
          linkUrl: link.to,
          enabled: link.visible,
          openInNewTab: link.to.startsWith('http'),
          sortOrder: link.sortOrder ?? now + index,
        },
      })
      await markImageAsUsed(imageUrl)
    }
  }

  const migrated = stripHoverImages(saved)
  await setSetting('navbar_config', JSON.stringify(migrated))
  clearSettingsCache()
  await invalidateNavigationAndAdsCache(NAV_MENU_AD_SLOT)
  return migrated
}

export async function getMigratedFullNavConfig(saved: NavConfig | LegacyNavConfig | null): Promise<NavConfig> {
  if (hasLegacyNavAds(saved)) {
    return getFullNavConfig(await migrateLegacyNavAds(saved as LegacyNavConfig))
  }

  return getFullNavConfig(saved)
}

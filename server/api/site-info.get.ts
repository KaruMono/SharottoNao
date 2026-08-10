import { getSiteName, getSiteDescription, getSetting } from '~/server/utils/settings'
import { cachedFetch, CacheKeys, CacheTTL } from '~/server/utils/redis'

export default defineEventHandler(async () => {
  return cachedFetch('site-info', async () => {
    const [
      siteName,
      siteDescription,
      favicon,
      touchIcon,
      headerScripts,
      footerScripts,
      footerHtml,
      customMetaTags,
      cdnType,
      cdnUrl,
      gravatarCdn,
      gravatarCdnUrl,
      downloadVisibility,
    ] = await Promise.all([
      getSiteName(),
      getSiteDescription(),
      getSetting('favicon'),
      getSetting('touch_icon'),
      getSetting('header_scripts'),
      getSetting('footer_scripts'),
      getSetting('footer_html'),
      getSetting('custom_meta_tags'),
      getSetting('cdn_type'),
      getSetting('cdn_url'),
      getSetting('gravatar_cdn'),
      getSetting('gravatar_cdn_url'),
      getSetting('download_visibility'),
    ])

    return {
      siteName,
      siteDescription,
      favicon: favicon || '',
      touchIcon: touchIcon || '',
      headerScripts: headerScripts || '',
      footerScripts: footerScripts || '',
      footerHtml: footerHtml || '',
      customMetaTags: customMetaTags || '',
      cdnType: cdnType || 'none',
      cdnUrl: cdnUrl || '',
      gravatarCdn: gravatarCdn || 'default',
      gravatarCdnUrl: gravatarCdnUrl || '',
      downloadVisibility: (downloadVisibility || 'login_required') as 'login_required' | 'always_show',
    }
  }, CacheTTL.MEDIUM)
})

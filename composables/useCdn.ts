const CDN_BASES: Record<string, string> = {
  lolicdn: 'https://cdnjs.loli.net/ajax/libs/',
  jsdelivr: 'https://cdn.jsdelivr.net/npm/',
  cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/',
  unpkg: 'https://unpkg.com/',
}

const FA_PATHS: Record<string, string> = {
  lolicdn: 'font-awesome/6.5.1/css/all.min.css',
  jsdelivr: '@fortawesome/fontawesome-free@6.5.1/css/all.min.css',
  cdnjs: 'font-awesome/6.5.1/css/all.min.css',
  unpkg: '@fortawesome/fontawesome-free@6.5.1/css/all.min.css',
}

export function useCdn() {
  const siteSettings = useState<Record<string, string>>('siteSettings', () => ({}))
  const cdnType = computed(() => siteSettings.value?.cdn_type || 'none')
  const customCdnUrl = computed(() => siteSettings.value?.cdn_url || '')

  function getCdnBase(): string {
    if (cdnType.value === 'custom' && customCdnUrl.value) {
      const base = customCdnUrl.value
      return base.endsWith('/') ? base : base + '/'
    }
    return CDN_BASES[cdnType.value] || ''
  }

  function getCdnUrl(path: string): string {
    const base = getCdnBase()
    if (!base) return path
    return base + path
  }

  function getFontAwesomeCdnUrl(): string | null {
    if (cdnType.value === 'none') return null
    if (cdnType.value === 'custom' && customCdnUrl.value) {
      const base = customCdnUrl.value.endsWith('/') ? customCdnUrl.value : customCdnUrl.value + '/'
      return base + '@fortawesome/fontawesome-free@6.5.1/css/all.min.css'
    }
    return (CDN_BASES[cdnType.value] || '') + (FA_PATHS[cdnType.value] || '')
  }

  function getImageUrl(url: string | null | undefined): string {
    if (!url) return ''
    // 绝对 URL 直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // 相对路径：如果配置了 CDN，拼接 CDN 前缀
    const base = getCdnBase()
    if (base) {
      return base + url.replace(/^\/+/, '')
    }
    return url
  }

  return {
    cdnType,
    getCdnBase,
    getCdnUrl,
    getFontAwesomeCdnUrl,
    getImageUrl,
  }
}

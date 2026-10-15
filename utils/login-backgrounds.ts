export function parseLoginBackgrounds(value: string | null | undefined): string[] {
  return [...new Set((value || '').split(/\r?\n/).map(url => url.trim()).filter(Boolean))]
}

export function isLoginBackgroundUrl(value: string): boolean {
  if (/[\s\\]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
  } catch {
    return false
  }
}

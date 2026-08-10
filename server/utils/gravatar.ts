import { createHash } from 'crypto'
import prisma from '~/server/utils/prisma'

const GRAVATAR_MIRRORS: Record<string, string> = {
  default: 'https://www.gravatar.com/avatar',
  cravatar: 'https://cravatar.cn/avatar',
  loli: 'https://gravatar.loli.net/avatar',
  weavatar: 'https://weavatar.com/avatar',
}

let cachedGravatarBase: string | null = null
let cacheTime = 0
const CACHE_TTL = 60_000

async function getGravatarBaseUrl(): Promise<string> {
  const now = Date.now()
  if (cachedGravatarBase && now - cacheTime < CACHE_TTL) {
    return cachedGravatarBase
  }

  try {
    const cdnSetting = await prisma.setting.findUnique({ where: { key: 'gravatar_cdn' } })
    const cdnType = cdnSetting?.value || 'default'

    if (cdnType === 'custom') {
      const customUrl = await prisma.setting.findUnique({ where: { key: 'gravatar_cdn_url' } })
      cachedGravatarBase = customUrl?.value || GRAVATAR_MIRRORS.default
    } else {
      cachedGravatarBase = GRAVATAR_MIRRORS[cdnType] || GRAVATAR_MIRRORS.default
    }
  } catch {
    cachedGravatarBase = GRAVATAR_MIRRORS.default
  }

  cacheTime = now
  return cachedGravatarBase
}

const gravatarExistsCache = new Map<string, boolean>()

async function hasGravatar(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase()
  const cached = gravatarExistsCache.get(normalizedEmail)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(await getGravatarUrl(normalizedEmail), {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    })
    const exists = response.ok
    gravatarExistsCache.set(normalizedEmail, exists)
    return exists
  } catch {
    gravatarExistsCache.set(normalizedEmail, false)
    return false
  }
}

export async function getGravatarUrl(email: string, size = 200): Promise<string> {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  const base = await getGravatarBaseUrl()
  return `${base}/${hash}?s=${size}&d=404`
}

export function isUploadedAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) return false
  if (avatar.startsWith('/uploads/avatars/') || avatar.startsWith('/uploads/images/')) return true

  const normalized = avatar.replace(/\/+$/, '')
  return normalized.includes('/avatars/') || normalized.includes('/images/')
}

export function isGeneratedAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) return false
  return Object.values(GRAVATAR_MIRRORS).some(base => avatar.startsWith(base))
}

export async function resolveAvatar(avatar: string | null | undefined, email: string | null | undefined): Promise<string | null> {
  if (isGeneratedAvatar(avatar)) {
    if (!email) return null
    return await hasGravatar(email) ? getGravatarUrl(email) : null
  }
  if (avatar) return avatar
  if (!email) return null
  return await hasGravatar(email) ? getGravatarUrl(email) : null
}

export async function resolveDefaultAvatar(email: string): Promise<string | null> {
  return await hasGravatar(email) ? getGravatarUrl(email) : null
}

import { invalidateCache } from '~/server/utils/redis'

async function invalidateNitroCache(matchers: string[]) {
  try {
    const storage = useStorage('cache')
    const keys = await storage.getKeys()
    await Promise.all(
      keys
        .filter(key => matchers.some(matcher => key.includes(matcher)))
        .map(key => storage.removeItem(key))
    )
  } catch {
    // Cache invalidation is best-effort and should not block writes.
  }
}

export async function invalidateNavConfigCache() {
  await Promise.all([
    invalidateCache('site:settings'),
    invalidateNitroCache(['nav-config']),
  ])
}

export async function invalidateAdsCache(slot?: string) {
  await Promise.all([
    invalidateCache(slot ? `ads:${slot}` : 'ads:*'),
    invalidateNitroCache(['ads']),
  ])
}

export async function invalidateNavigationAndAdsCache(slot?: string) {
  await Promise.all([
    invalidateNavConfigCache(),
    invalidateAdsCache(slot),
  ])
}

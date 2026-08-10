import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Authenticate trusted site-to-site API requests with a server-only key.
 * Hashing both values keeps the comparison constant-time even when lengths differ.
 */
export function requirePrivateApiKey(event: H3Event): void {
  const configuredKey = String(useRuntimeConfig().privateApiKey || '').trim()
  const providedKey = getHeader(event, 'x-api-key')?.trim()

  if (Buffer.byteLength(configuredKey, 'utf8') < 32 || !providedKey) {
    throw createError({ statusCode: 401, message: 'API key 无效' })
  }

  const expectedDigest = createHash('sha256').update(configuredKey).digest()
  const providedDigest = createHash('sha256').update(providedKey).digest()

  if (!timingSafeEqual(expectedDigest, providedDigest)) {
    throw createError({ statusCode: 401, message: 'API key 无效' })
  }
}

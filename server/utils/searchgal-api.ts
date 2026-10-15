import { createHash, timingSafeEqual } from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import { z } from 'zod'

/** This credential is deliberately independent of the full-resource private API. */
export function requireSearchgalApiKey(event: H3Event): void {
  const configuredKey = useRuntimeConfig().searchgalApiKey
  const providedKey = getHeader(event, 'x-api-key')
  if (typeof configuredKey !== 'string' || Buffer.byteLength(configuredKey, 'utf8') < 32 || !providedKey) {
    throw createError({ statusCode: 401, message: 'API key 无效' })
  }

  const digest = (key: string) => createHash('sha256').update(key, 'utf8').digest()
  if (!timingSafeEqual(digest(configuredKey), digest(providedKey))) {
    throw createError({ statusCode: 401, message: 'API key 无效' })
  }
}

// Runtime environment overrides may still be strings; Boolean('false') is unsafe.
export function searchgalIncludesNsfw(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true')
}

export const searchgalQuerySchema = z.object({
  q: z.string().trim().refine(q => {
    const length = Array.from(q).length
    return length >= 1 && length <= 100 && !q.includes('\0')
  }, '关键词须为 1～100 个 Unicode 字符，且不能包含空字符'),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1).max(20)).default('12'),
}).strict()

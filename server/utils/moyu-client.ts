import { z } from 'zod'
import type { MoyuList, MoyuPatch } from '../../types/moyu'

const API_URL = 'https://api.nextmoe.dev/v2/moyu/patches'
const CACHE_TTL = 300_000
const MAX_CACHE_ENTRIES = 200

const id = z.string().regex(/^\d+$/)
const webUrl = z.string().url().refine(value => new URL(value).protocol === 'https:')
const publisherSchema = z.object({
  object: z.literal('user'),
  id,
  name: z.string(),
  avatar_url: z.string(),
  web_url: webUrl,
})
const resourceSchema = z.object({
  object: z.literal('patch_resource'),
  id,
  patch_id: id,
  name: z.string(),
  storage: z.enum(['s3', 'user']),
  size: z.string(),
  hash: z.string(),
  model_name: z.string(),
  localization_group_name: z.string(),
  note: z.string(),
  // Allow future vocabulary additions; the UI falls back to the original value.
  type: z.array(z.string()),
  language: z.array(z.string()),
  platform: z.array(z.string()),
  download_count: z.number().int().nonnegative(),
  like_count: z.number().int().nonnegative(),
  web_url: webUrl,
  created_at: z.string(),
  updated_at: z.string(),
  publisher: publisherSchema.optional(),
})
const patchSchema = z.object({
  object: z.literal('patch'),
  id,
  vndb_id: z.string(),
  catalog_work_id: id.nullable(),
  content_limit: z.enum(['sfw', 'nsfw']).nullable(),
  release_date: z.string().nullable(),
  type: z.array(z.string()),
  language: z.array(z.string()),
  platform: z.array(z.string()),
  resource_count: z.number().int().nonnegative(),
  download_count: z.number().int().nonnegative(),
  view_count: z.number().int().nonnegative(),
  favorite_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  web_url: webUrl,
  created_at: z.string(),
  updated_at: z.string(),
  resource_updated_at: z.string(),
  publisher: publisherSchema.optional(),
  // Requested explicitly below; omission is a contract failure, not an empty page.
  resources: z.array(resourceSchema),
})
const patchListSchema = z.object({
  object: z.literal('list'),
  items: z.array(patchSchema),
  next_cursor: z.null(), // refs is a batch lookup, never a cursor page.
  total: z.number().int().nonnegative().nullable(),
  missing: z.array(z.string()),
})

type MoyuErrorCode = 'NOT_CONFIGURED' | 'CREDENTIAL_ERROR' | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' | 'TIMEOUT'

export class MoyuApiError extends Error {
  constructor(
    public readonly code: MoyuErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly retryAfter?: number,
    public readonly upstreamCode?: string,
  ) {
    super(message)
    this.name = 'MoyuApiError'
  }
}

interface CacheEntry {
  data: MoyuList<MoyuPatch>
  etag: string | null
  expiresAt: number
}

/** Server-only client. Each instance owns one application's cache and cooldown. */
export function createMoyuClient(apiKey: string, request: typeof fetch = fetch) {
  const key = apiKey.trim()
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<string, Promise<MoyuList<MoyuPatch>>>()
  let cooldown: { until: number; code: 'RATE_LIMITED' | 'QUOTA_EXCEEDED' } | undefined

  async function fetchPatches(url: string, previous?: CacheEntry): Promise<MoyuList<MoyuPatch>> {
    const headers = new Headers({ Authorization: `Bearer ${key}`, Accept: 'application/json' })
    if (previous?.etag) headers.set('If-None-Match', previous.etag)

    let response: Response
    try {
      response = await request(url, { headers, signal: AbortSignal.timeout(10_000), redirect: 'error' })
    } catch (error) {
      if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
        throw new MoyuApiError('TIMEOUT', 504, '补丁服务响应超时，请稍后重试')
      }
      throw new MoyuApiError('UPSTREAM_ERROR', 502, '补丁服务暂时无法连接，请稍后重试')
    }

    if (response.status === 304 && previous) {
      previous.expiresAt = Date.now() + CACHE_TTL
      return previous.data
    }

    if (!response.ok) {
      // Branch on HTTP status first, then RFC 9457 code. Never expose upstream
      // detail or the request object: either could contain credentials.
      const problem: unknown = await response.json().catch(() => null)
      const parsed = z.object({ code: z.string().optional() }).safeParse(problem)
      const code = parsed.success ? parsed.data.code : undefined
      if (response.status === 401) {
        throw new MoyuApiError('CREDENTIAL_ERROR', 503, '补丁服务暂不可用，请联系管理员检查配置', undefined, code)
      }
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After') ?? 60)
        const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60
        const rateCode = code === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED'
        cooldown = { until: Date.now() + retryAfter * 1000, code: rateCode }
        throw new MoyuApiError(rateCode, 429, '补丁服务请求较多，请稍后重试', retryAfter, code)
      }
      throw new MoyuApiError('UPSTREAM_ERROR', 502, '补丁服务暂不可用，请稍后重试', undefined, code)
    }

    const body: unknown = await response.json().catch(() => null)
    const parsed = patchListSchema.safeParse(body)
    if (!parsed.success) {
      throw new MoyuApiError('INVALID_RESPONSE', 502, '补丁服务返回的数据异常，请稍后重试')
    }
    // strictNullChecks is disabled in this project, so Zod infers required keys
    // as optional. The runtime schema above has already checked every key.
    const data = parsed.data as MoyuList<MoyuPatch>
    // Successful empty results are cached too; failures are never cached as empty.
    cache.delete(url)
    cache.set(url, { data, etag: response.headers.get('ETag'), expiresAt: Date.now() + CACHE_TTL })
    if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
    return data
  }

  return {
    async findPatches(vndbId: string, nsfw = false): Promise<MoyuList<MoyuPatch>> {
      if (!key) throw new MoyuApiError('NOT_CONFIGURED', 503, '补丁服务尚未启用')
      const normalizedId = vndbId.trim().toLowerCase()
      if (!/^v[1-9]\d*$/.test(normalizedId)) {
        throw new MoyuApiError('INVALID_RESPONSE', 502, '该游戏的 VNDB ID 无效，暂时无法查询补丁')
      }
      const url = new URL(API_URL)
      url.search = new URLSearchParams({
        refs: `vndb:${normalizedId}`,
        include: 'resources,publisher',
        nsfw: String(nsfw),
      }).toString()
      const cacheKey = url.toString()
      const previous = cache.get(cacheKey)
      if (previous && previous.expiresAt > Date.now()) return previous.data
      if (cooldown && cooldown.until > Date.now()) {
        throw new MoyuApiError(cooldown.code, 429, '补丁服务请求较多，请稍后重试', Math.ceil((cooldown.until - Date.now()) / 1000))
      }
      const running = pending.get(cacheKey)
      if (running) return running
      const promise = fetchPatches(cacheKey, previous)
      pending.set(cacheKey, promise)
      try {
        return await promise
      } finally {
        pending.delete(cacheKey)
      }
    },
  }
}

let activeClient: ReturnType<typeof createMoyuClient> | undefined
let activeKey: string | undefined

export function getMoyuClient(apiKey: string) {
  if (!activeClient || activeKey !== apiKey) {
    activeKey = apiKey
    activeClient = createMoyuClient(apiKey)
  }
  return activeClient
}

import { isAdultVndbTag, type VndbTagInput } from './vndb-tag-sync'

interface VndbTitle {
  title: string
  lang: string
  latin?: string | null
}

interface VndbImage {
  url: string
  sexual: number
  violence: number
}

interface VndbApiTag extends VndbTagInput {}

interface VndbStaff {
  name: string
  original: string | null
  role: string
  note: string | null
}

interface VndbDeveloper {
  name: string
  original: string | null
}

interface VndbResult {
  id: string
  title: string
  titles: VndbTitle[]
  aliases: string[]
  released: string | null
  description: string | null
  image?: VndbImage | null
  tags?: VndbApiTag[]
  length_minutes: number | null
  staff?: VndbStaff[]
  developers?: VndbDeveloper[]
}

interface VndbResponse {
  results: VndbResult[]
}

export interface VndbGameData {
  vndbId: string
  titleEn: string | null
  titleJa: string | null
  titleZhHans: string | null
  titleZhHant: string | null
  aliases: string[]
  descriptionEn: string | null
  released: string | null
  coverImage: string | null
  isNsfw: boolean
  lengthMinutes: number | null
  tags: VndbTagInput[]
  staff: Array<{
    name: string
    nameOriginal: string | null
    role: string
    characterName: string | null
  }>
  developers: Array<{
    name: string
    nameOriginal: string | null
  }>
}

export type PublicVndbGameData = Omit<VndbGameData, 'tags'>

export class VndbClientError extends Error {
  readonly statusCode: number
  readonly statusMessage: string

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'VndbClientError'
    this.statusCode = statusCode
    this.statusMessage = message
  }
}

const VNDB_FIELDS = [
  'title',
  'titles.title',
  'titles.lang',
  'titles.latin',
  'titles.official',
  'titles.main',
  'aliases',
  'released',
  'description',
  'image.url',
  'image.dims',
  'image.sexual',
  'image.violence',
  'tags{id,name,rating,spoiler,category}',
  'devstatus',
  'length',
  'length_minutes',
  'staff{id,name,original,role,note}',
  'developers{id,name,original}',
].join(', ')

const VNDB_API_URL = 'https://api.vndb.org/kana/vn'
const VNDB_REQUEST_TIMEOUT_MS = 15_000
const VNDB_MAX_ATTEMPTS = 3
const VNDB_RETRY_BASE_DELAY_MS = 500
const VNDB_RETRY_MAX_DELAY_MS = 60_000

const VNDB_ROLE_MAP: Record<string, string> = {
  director: 'DIRECTOR',
  scenario: 'WRITER',
  composer: 'COMPOSER',
  music: 'COMPOSER',
  artist: 'ARTIST',
  chardesign: 'ARTIST',
  vocals: 'VOICE_ACTOR',
}

export function normalizeVndbId(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!/^v\d+$/.test(normalized)) {
    throw new VndbClientError(400, 'VNDB ID 格式错误，应为 v 开头加数字，如 v27448')
  }
  return normalized
}

export function cleanVndbDescription(text: string | null): string | null {
  if (!text) return null
  return text
    .replace(/\[url=[^\]]*\]/g, '')
    .replace(/\[\/url\]/g, '')
    .replace(/\[\/?(?:spoiler|b|i)\]/g, '')
}

function uniqueAliases(vn: VndbResult, titles: Array<string | null>): string[] {
  const used = new Set(titles.filter((title): title is string => Boolean(title)))
  const aliases: string[] = []

  for (const value of [vn.title, ...vn.titles.flatMap(title => [title.title, title.latin]), ...vn.aliases]) {
    const alias = value?.trim()
    if (!alias || used.has(alias)) continue
    used.add(alias)
    aliases.push(alias)
  }

  return aliases
}

export function mapVndbResult(vn: VndbResult): VndbGameData {
  const titleEn = vn.titles.find(title => title.lang === 'en')?.title || null
  const titleJa = vn.titles.find(title => title.lang === 'ja')?.title || null
  const titleZhHans = vn.titles.find(title => title.lang === 'zh-Hans')?.title || null
  const titleZhHant = vn.titles.find(title => title.lang === 'zh-Hant')?.title || null
  const tags = (vn.tags || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    rating: tag.rating,
    spoiler: tag.spoiler,
    ...(tag.category && { category: tag.category }),
  }))

  const nsfwByImage = Boolean(vn.image && (vn.image.sexual > 1 || vn.image.violence > 1))
  const nsfwByTags = tags.some(tag => isAdultVndbTag(tag) && tag.rating >= 1.5)

  const staffByCredit = new Map<string, VndbGameData['staff'][number]>()
  for (const person of vn.staff || []) {
    const role = VNDB_ROLE_MAP[person.role]
    if (!role) continue

    const staff = {
      name: person.original || person.name,
      nameOriginal: person.original ? person.name : null,
      role,
      characterName: person.role === 'vocals' ? person.note : null,
    }
    const key = `${staff.name}\u0000${staff.role}`
    const existing = staffByCredit.get(key)
    if (!existing || (!existing.characterName && staff.characterName)) {
      staffByCredit.set(key, staff)
    }
  }

  return {
    vndbId: vn.id,
    titleEn,
    titleJa,
    titleZhHans,
    titleZhHant,
    aliases: uniqueAliases(vn, [titleEn, titleJa, titleZhHans, titleZhHant]),
    descriptionEn: cleanVndbDescription(vn.description),
    released: vn.released,
    coverImage: vn.image?.url || null,
    isNsfw: nsfwByImage || nsfwByTags,
    lengthMinutes: vn.length_minutes,
    tags,
    staff: [...staffByCredit.values()],
    developers: (vn.developers || []).map(developer => ({
      name: developer.name,
      nameOriginal: developer.original || null,
    })),
  }
}

/** Public form-prefill responses must not expose raw English/R18 tag names. */
export function toPublicVndbGameData(data: VndbGameData): PublicVndbGameData {
  const { tags: _rawTags, ...publicData } = data
  return publicData
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null

  const normalized = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return Math.min(Math.ceil(Number(normalized) * 1000), VNDB_RETRY_MAX_DELAY_MS)
  }

  const retryAt = Date.parse(normalized)
  if (Number.isNaN(retryAt)) return null
  return Math.min(Math.max(retryAt - Date.now(), 0), VNDB_RETRY_MAX_DELAY_MS)
}

function retryDelay(attempt: number, retryAfter: string | null = null): number {
  return parseRetryAfter(retryAfter)
    ?? Math.min(VNDB_RETRY_BASE_DELAY_MS * 2 ** attempt, VNDB_RETRY_MAX_DELAY_MS)
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type VndbRequestResult =
  | { ok: true, data: VndbResponse }
  | { ok: false, status: number, retryAfter: string | null }

async function requestVndbGame(vndbId: string): Promise<VndbRequestResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VNDB_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(VNDB_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['id', '=', vndbId],
        fields: VNDB_FIELDS,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      await response.body?.cancel()
      return {
        ok: false,
        status: response.status,
        retryAfter: response.headers.get('Retry-After'),
      }
    }

    return {
      ok: true,
      data: await response.json() as VndbResponse,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchVndbGame(value: string): Promise<VndbGameData> {
  const vndbId = normalizeVndbId(value)

  for (let attempt = 0; attempt < VNDB_MAX_ATTEMPTS; attempt++) {
    let response: VndbRequestResult

    try {
      response = await requestVndbGame(vndbId)
    } catch (error: unknown) {
      if (error instanceof VndbClientError) throw error

      if (attempt < VNDB_MAX_ATTEMPTS - 1) {
        await wait(retryDelay(attempt))
        continue
      }

      console.error('VNDB API error:', error)
      throw new VndbClientError(502, 'VNDB API 请求失败，请稍后重试')
    }

    if (!response.ok) {
      if (isRetryableStatus((response as any).status) && attempt < VNDB_MAX_ATTEMPTS - 1) {
        await wait(retryDelay(attempt, (response as any).retryAfter))
        continue
      }

      throw new VndbClientError(502, 'VNDB API 请求失败')
    }

    try {
      const result = response.data.results[0]
      if (!result) {
        throw new VndbClientError(404, '未找到对应的 VNDB 条目')
      }

      return mapVndbResult(result)
    } catch (error: unknown) {
      if (error instanceof VndbClientError) throw error
      console.error('VNDB API error:', error)
      throw new VndbClientError(502, 'VNDB API 请求失败，请稍后重试')
    }
  }

  throw new VndbClientError(502, 'VNDB API 请求失败，请稍后重试')
}

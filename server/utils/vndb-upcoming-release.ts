import prisma from '~/server/utils/prisma'
import { createGameFromVndb } from '~/server/utils/resource-sync'
import { invalidateGameCaches } from '~/server/utils/redis'

const VNDB_UPCOMING_RELEASE_FIELDS = 'id, title, released, olang, image.url, titles.lang, titles.title, titles.main, developers{id,name,original,lang}'
const DEFAULT_LOOKAHEAD_DAYS = 14
const MAX_LOOKAHEAD_DAYS = 30
const VNDB_RESULTS_LIMIT = 100
const PREFERRED_ORIGINAL_LANGUAGES = ['ja', 'zh', 'zh-Hans', 'zh-Hant'] as const

type VndbUpcomingTitle = {
  lang: string
  title: string
  main: boolean
}

type VndbUpcomingDeveloper = {
  id: string
  name: string
  original: string | null
  lang: string | null
}

type VndbUpcomingRelease = {
  id: string
  title: string
  released: string | null
  olang: string | null
  image?: {
    url: string
  } | null
  titles?: VndbUpcomingTitle[]
  developers?: VndbUpcomingDeveloper[]
}

type VndbUpcomingReleaseResponse = {
  more: boolean
  results: VndbUpcomingRelease[]
}

export type VndbUpcomingCandidateStatus = 'available' | 'existing' | 'deleted'

export type VndbUpcomingCandidate = {
  vndbId: string
  title: string
  releaseDate: string
  coverImage: string | null
  developers: string[]
  status: VndbUpcomingCandidateStatus
  existingGameId: number | null
}

export type VndbUpcomingCandidatesResult = {
  days: number
  startDate: string
  endDate: string
  candidates: VndbUpcomingCandidate[]
}

export type VndbUpcomingPublishResult = {
  created: number
  skipped: number
  failed: number
  createdIds: string[]
  skippedIds: string[]
  failedIds: string[]
  items: Array<{
    vndbId: string
    status: 'created' | 'skipped' | 'failed'
    gameId?: number
    message?: string
  }>
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDays(days?: number) {
  if (!Number.isFinite(days)) return DEFAULT_LOOKAHEAD_DAYS
  return Math.min(Math.max(Math.floor(days!), 1), MAX_LOOKAHEAD_DAYS)
}

function getUpcomingReleaseRange(days = DEFAULT_LOOKAHEAD_DAYS, now = new Date()) {
  const normalizedDays = normalizeDays(days)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const endExclusive = new Date(start)
  endExclusive.setDate(start.getDate() + normalizedDays)

  const endInclusive = new Date(endExclusive)
  endInclusive.setDate(endExclusive.getDate() - 1)

  return {
    days: normalizedDays,
    startDate: formatDate(start),
    endDate: formatDate(endInclusive),
    endExclusiveDate: formatDate(endExclusive),
  }
}

function isFullDate(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isPreferredOriginalLanguage(lang?: string | null): boolean {
  return PREFERRED_ORIGINAL_LANGUAGES.includes(lang as typeof PREFERRED_ORIGINAL_LANGUAGES[number])
}

function isPreferredGalgameCandidate(item: VndbUpcomingRelease): boolean {
  if (isPreferredOriginalLanguage(item.olang)) return true
  if (item.titles?.some(title => isPreferredOriginalLanguage(title.lang))) return true
  if (item.developers?.some(developer => isPreferredOriginalLanguage(developer.lang))) return true
  return false
}

function pickTitle(item: VndbUpcomingRelease): string {
  const titles = item.titles || []
  return titles.find(t => t.lang === 'zh-Hans')?.title
    || titles.find(t => t.lang === 'zh-Hant')?.title
    || titles.find(t => t.lang === 'ja' && t.main)?.title
    || titles.find(t => t.lang === 'ja')?.title
    || titles.find(t => t.lang === 'en' && t.main)?.title
    || titles.find(t => t.lang === 'en')?.title
    || item.title
    || item.id
}

function toCandidateBase(item: VndbUpcomingRelease) {
  return {
    vndbId: item.id.toLowerCase(),
    title: pickTitle(item),
    releaseDate: item.released!,
    coverImage: item.image?.url || null,
    developers: (item.developers || [])
      .map(developer => developer.original || developer.name)
      .filter(Boolean)
      .slice(0, 3),
  }
}

export async function fetchVndbUpcomingReleaseCandidates(
  days = DEFAULT_LOOKAHEAD_DAYS,
  now = new Date(),
): Promise<VndbUpcomingCandidatesResult> {
  const range = getUpcomingReleaseRange(days, now)

  const response = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: [
        'and',
        ['released', '>=', range.startDate],
        ['released', '<', range.endExclusiveDate],
      ],
      fields: VNDB_UPCOMING_RELEASE_FIELDS,
      sort: 'released',
      reverse: false,
      results: VNDB_RESULTS_LIMIT,
    }),
  })

  if (!response.ok) {
    throw new Error(`VNDB upcoming release request failed: HTTP ${response.status}`)
  }

  const data = await response.json() as VndbUpcomingReleaseResponse
  const candidateMap = new Map<string, ReturnType<typeof toCandidateBase>>()

  for (const item of data.results) {
    if (!isFullDate(item.released)) continue
    if (item.released < range.startDate || item.released >= range.endExclusiveDate) continue
    if (!isPreferredGalgameCandidate(item)) continue

    const candidate = toCandidateBase(item)
    if (!candidateMap.has(candidate.vndbId)) {
      candidateMap.set(candidate.vndbId, candidate)
    }
  }

  const candidates = [...candidateMap.values()]
  const existingGames = candidates.length
    ? await prisma.game.findMany({
        where: { vndbId: { in: candidates.map(candidate => candidate.vndbId) } },
        select: { id: true, vndbId: true, deletedAt: true },
      })
    : []
  const existingMap = new Map(existingGames.map(game => [game.vndbId, game]))

  return {
    days: range.days,
    startDate: range.startDate,
    endDate: range.endDate,
    candidates: candidates.map(candidate => {
      const existing = existingMap.get(candidate.vndbId)
      return {
        ...candidate,
        status: existing ? (existing.deletedAt ? 'deleted' : 'existing') : 'available',
        existingGameId: existing?.id || null,
      }
    }),
  }
}

export async function publishVndbUpcomingReleases(vndbIds: string[], creatorId: number): Promise<VndbUpcomingPublishResult> {
  const ids = [...new Set(vndbIds.map(id => id.trim().toLowerCase()).filter(id => /^v\d+$/.test(id)))]
  const result: VndbUpcomingPublishResult = {
    created: 0,
    skipped: 0,
    failed: 0,
    createdIds: [],
    skippedIds: [],
    failedIds: [],
    items: [],
  }

  for (const vndbId of ids) {
    try {
      const existing = await prisma.game.findUnique({
        where: { vndbId },
        select: { id: true, deletedAt: true },
      })

      if (existing) {
        result.skipped++
        result.skippedIds.push(vndbId)
        result.items.push({
          vndbId,
          status: 'skipped',
          gameId: existing.id,
          message: existing.deletedAt ? '该 VNDB ID 已被已删除条目占用' : '该 VNDB ID 已上架',
        })
        continue
      }

      const game = await createGameFromVndb(vndbId, creatorId, 'admin-vndb-upcoming-publish')
      result.created++
      result.createdIds.push(vndbId)
      result.items.push({
        vndbId,
        status: 'created',
        gameId: game.id,
      })
    } catch (error: any) {
      console.error(`[VNDB Upcoming Release Publish] Failed to import ${vndbId}:`, error)
      result.failed++
      result.failedIds.push(vndbId)
      result.items.push({
        vndbId,
        status: 'failed',
        message: error?.statusMessage || error?.message || '上架失败',
      })
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (result.created > 0) {
    invalidateGameCaches().catch(() => {})
  }

  return result
}

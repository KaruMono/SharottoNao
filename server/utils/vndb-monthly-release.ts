import prisma from '~/server/utils/prisma'
import { getSetting } from '~/server/utils/settings'
import { invalidateGameCaches } from '~/server/utils/redis'
import { createGameFromVndb, ensureDefaultUploaderId } from '~/server/utils/resource-sync'

const VNDB_MONTHLY_RELEASE_FIELDS = 'id, released, olang, titles.lang, titles.title, titles.main, developers{id,name,original,lang}'
const DEFAULT_SYNC_LIMIT = 20
const MAX_SYNC_LIMIT = 50
const PREFERRED_ORIGINAL_LANGUAGES = ['ja', 'zh', 'zh-Hans', 'zh-Hant'] as const

type VndbMonthlyRelease = {
  id: string
  released: string | null
  olang: string | null
  titles?: Array<{
    lang: string
    title: string
    main: boolean
  }>
  developers?: Array<{
    id: string
    name: string
    original: string | null
    lang: string | null
  }>
}

type VndbMonthlyReleaseResponse = {
  more: boolean
  results: VndbMonthlyRelease[]
}

export type MonthlyVndbSyncResult = {
  created: number
  skipped: number
  failed: number
  candidates: number
  createdIds: string[]
  skippedIds: string[]
  failedIds: string[]
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getCurrentMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    start,
    end,
    startDate: formatDate(start),
    endDate: formatDate(end),
    monthDate: formatMonth(start),
    nextMonthDate: formatMonth(nextMonth),
  }
}

export function getCurrentMonthRemainingRange(now = new Date()) {
  const range = getCurrentMonthRange(now)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  return {
    ...range,
    start,
    startDate: formatDate(start),
  }
}

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_SYNC_LIMIT
  return Math.min(Math.max(Math.floor(limit!), 1), MAX_SYNC_LIMIT)
}

function isPreferredOriginalLanguage(lang?: string | null): boolean {
  return PREFERRED_ORIGINAL_LANGUAGES.includes(lang as typeof PREFERRED_ORIGINAL_LANGUAGES[number])
}

function preferredOriginalLanguageFilter() {
  return [
    'or',
    ...PREFERRED_ORIGINAL_LANGUAGES.map(lang => ['olang', '=', lang]),
  ]
}

function isPreferredGalgameCandidate(item: VndbMonthlyRelease, startDate: string, monthDate: string, nextMonthDate: string): boolean {
  if (!item.released) return false

  const isInRange = item.released === monthDate || (item.released >= startDate && item.released < nextMonthDate)
  if (!isInRange) return false

  if (isPreferredOriginalLanguage(item.olang)) return true
  if (item.titles?.some(title => isPreferredOriginalLanguage(title.lang))) return true
  if (item.developers?.some(developer => isPreferredOriginalLanguage(developer.lang))) return true

  return false
}

export async function fetchVndbCurrentMonthUpcomingIds(limit = DEFAULT_SYNC_LIMIT, now = new Date()): Promise<string[]> {
  const { startDate, monthDate, nextMonthDate } = getCurrentMonthRemainingRange(now)

  const response = await fetch('https://api.vndb.org/kana/vn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: [
        'and',
        ['released', '>=', startDate],
        ['released', '<', nextMonthDate],
        preferredOriginalLanguageFilter(),
      ],
      fields: VNDB_MONTHLY_RELEASE_FIELDS,
      sort: 'released',
      reverse: false,
      results: normalizeLimit(limit) * 2,
    }),
  })

  if (!response.ok) {
    throw new Error(`VNDB monthly release request failed: HTTP ${response.status}`)
  }

  const data = await response.json() as VndbMonthlyReleaseResponse
  const ids = data.results
    .filter(item => isPreferredGalgameCandidate(item, startDate, monthDate, nextMonthDate))
    .map(item => item.id.toLowerCase())

  return [...new Set(ids)].slice(0, normalizeLimit(limit))
}

async function getMonthlySyncCreatorId(): Promise<number> {
  const configuredCreatorId = parseInt(await getSetting('vndb_monthly_sync_creator_id') || '')
  if (configuredCreatorId) {
    return ensureDefaultUploaderId(configuredCreatorId)
  }

  const resourceSyncUploaderId = parseInt(await getSetting('resource_sync_uploader_id') || '')
  return ensureDefaultUploaderId(resourceSyncUploaderId || undefined)
}

export async function syncCurrentMonthVndbReleases(limit = DEFAULT_SYNC_LIMIT, now = new Date()): Promise<MonthlyVndbSyncResult> {
  const vndbIds = await fetchVndbCurrentMonthUpcomingIds(limit, now)
  const creatorId = await getMonthlySyncCreatorId()

  const result: MonthlyVndbSyncResult = {
    created: 0,
    skipped: 0,
    failed: 0,
    candidates: vndbIds.length,
    createdIds: [],
    skippedIds: [],
    failedIds: [],
  }

  for (const vndbId of vndbIds) {
    try {
      const existing = await prisma.game.findFirst({
        where: { vndbId, deletedAt: null },
        select: { id: true },
      })

      if (existing) {
        result.skipped++
        result.skippedIds.push(vndbId)
        continue
      }

      await createGameFromVndb(vndbId, creatorId, 'vndb-monthly-release-sync')
      result.created++
      result.createdIds.push(vndbId)
    } catch (error) {
      console.error(`[VNDB Monthly Release Sync] Failed to import ${vndbId}:`, error)
      result.failed++
      result.failedIds.push(vndbId)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (result.created > 0) {
    invalidateGameCaches().catch(() => {})
  }

  return result
}

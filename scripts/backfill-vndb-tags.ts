import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { pathToFileURL } from 'node:url'
import { TagDisplayTier, VndbTagStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export const DEFAULT_INTERVAL_MS = 1600
export const DEFAULT_BATCH_SIZE = 50
export const MAX_BATCH_SIZE = 500
export const CACHE_DELETE_BATCH_SIZE = 200
export const REDIS_CONNECT_TIMEOUT_MS = 5000
export const BACKFILL_CACHE_PATTERNS = Object.freeze([
  'home:*',
  'search:*',
  'suggest:*',
  'games:*',
  'calendar:*',
  'leaderboard:*',
  'game:*',
  'tags:*',
] as const)

export interface CliOptions {
  apply: boolean
  force: boolean
  help: boolean
  limit?: number
  gameId?: number
  afterId?: number
  batchSize: number
  intervalMs: number
}

export interface CursorPaginationState {
  afterId?: number
  processed: number
}

export interface CursorPageRequest {
  afterId?: number
  take: number
}

export interface CacheDeletionClient {
  scanIterator(options: { MATCH: string; COUNT: number }): AsyncIterable<string>
  del(keys: string[]): Promise<number>
}

interface FailedGame {
  gameId: number
  vndbId: string
  message: string
}

interface PreviewResult {
  rawTagCount: number
  appliedTagCount: number
  pendingTagCount: number
  ignoredTagCount: number
  suggestsGameNsfw: boolean
}

function usage() {
  console.log(`VNDB 标签存量回填

用法：
  pnpm db:backfill-vndb-tags [选项]

选项：
  --apply                 写入数据库；省略时为 dry-run
  --limit <数量>          最多处理多少个候选游戏
  --batch-size <数量>     每批读取多少个游戏（默认 ${DEFAULT_BATCH_SIZE}，最大 ${MAX_BATCH_SIZE}）
  --after-id <游戏 ID>    只扫描大于该 ID 的游戏，用于从游标续跑
  --game-id <游戏 ID>     只处理一个站内游戏
  --force                 包含已有 vndbTagsSyncedAt 的游戏
  --interval-ms <毫秒>    VNDB 请求之间的间隔（默认 ${DEFAULT_INTERVAL_MS}，最小 250）
  --help                  显示帮助

示例：
  pnpm db:backfill-vndb-tags --limit 20
  pnpm db:backfill-vndb-tags --game-id 123 --apply
  pnpm db:backfill-vndb-tags --batch-size 50 --apply
  pnpm db:backfill-vndb-tags --after-id 800 --limit 100 --apply
  pnpm db:backfill-vndb-tags --force --limit 100 --apply`)
}

function parsePositiveInteger(value: string | undefined, option: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${option} 必须是正整数`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} 必须是正整数`)
  }
  return parsed
}

function parseInterval(value: string | undefined): number {
  const interval = parsePositiveInteger(value, '--interval-ms')
  if (interval < 250 || interval > 60_000) {
    throw new Error('--interval-ms 必须在 250 到 60000 之间')
  }
  return interval
}

function parseBatchSize(value: string | undefined): number {
  const batchSize = parsePositiveInteger(value, '--batch-size')
  if (batchSize > MAX_BATCH_SIZE) {
    throw new Error(`--batch-size 不能大于 ${MAX_BATCH_SIZE}`)
  }
  return batchSize
}

function readOptionValue(args: string[], index: number, option: string): [string, number] {
  const argument = args[index]
  const inlinePrefix = `${option}=`
  if (argument.startsWith(inlinePrefix)) {
    return [argument.slice(inlinePrefix.length), index]
  }
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 缺少参数`)
  }
  return [value, index + 1]
}

export function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    force: false,
    help: false,
    batchSize: DEFAULT_BATCH_SIZE,
    intervalMs: DEFAULT_INTERVAL_MS,
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--') continue
    if (argument === '--apply') {
      options.apply = true
      continue
    }
    if (argument === '--force') {
      options.force = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }
    if (argument === '--limit' || argument.startsWith('--limit=')) {
      const [value, consumedIndex] = readOptionValue(args, index, '--limit')
      options.limit = parsePositiveInteger(value, '--limit')
      index = consumedIndex
      continue
    }
    if (argument === '--game-id' || argument.startsWith('--game-id=')) {
      const [value, consumedIndex] = readOptionValue(args, index, '--game-id')
      options.gameId = parsePositiveInteger(value, '--game-id')
      index = consumedIndex
      continue
    }
    if (argument === '--after-id' || argument.startsWith('--after-id=')) {
      const [value, consumedIndex] = readOptionValue(args, index, '--after-id')
      options.afterId = parsePositiveInteger(value, '--after-id')
      index = consumedIndex
      continue
    }
    if (argument === '--batch-size' || argument.startsWith('--batch-size=')) {
      const [value, consumedIndex] = readOptionValue(args, index, '--batch-size')
      options.batchSize = parseBatchSize(value)
      index = consumedIndex
      continue
    }
    if (argument === '--interval-ms' || argument.startsWith('--interval-ms=')) {
      const [value, consumedIndex] = readOptionValue(args, index, '--interval-ms')
      options.intervalMs = parseInterval(value)
      index = consumedIndex
      continue
    }
    throw new Error(`未知选项：${argument}`)
  }

  if (options.gameId !== undefined && options.afterId !== undefined) {
    throw new Error('--game-id 不能与 --after-id 同时使用')
  }

  return options
}

/** Return the next bounded database page without depending on Prisma. */
export function getNextCursorPageRequest(
  state: Readonly<CursorPaginationState>,
  options: Readonly<Pick<CliOptions, 'batchSize' | 'limit'>>,
): CursorPageRequest | null {
  const remaining = options.limit === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(options.limit - state.processed, 0)

  if (remaining === 0) return null
  return {
    afterId: state.afterId,
    take: Math.min(options.batchSize, remaining),
  }
}

/** Advance an exclusive primary-key cursor after a processed page. */
export function advanceCursorPagination(
  state: Readonly<CursorPaginationState>,
  processedIds: readonly number[],
): CursorPaginationState {
  let afterId = state.afterId

  for (const id of processedIds) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new TypeError(`分页结果包含无效游戏 ID：${id}`)
    }
    if (afterId !== undefined && id <= afterId) {
      throw new Error(`分页结果未按游戏 ID 严格递增：${id} <= ${afterId}`)
    }
    afterId = id
  }

  return {
    afterId,
    processed: state.processed + processedIds.length,
  }
}

export async function deleteBackfillCacheKeys(
  client: CacheDeletionClient,
): Promise<number> {
  let deletedCount = 0

  for (const pattern of BACKFILL_CACHE_PATTERNS) {
    const keys: string[] = []
    for await (const key of client.scanIterator({
      MATCH: pattern,
      COUNT: CACHE_DELETE_BATCH_SIZE,
    })) {
      keys.push(key)
      if (keys.length >= CACHE_DELETE_BATCH_SIZE) {
        deletedCount += await client.del(keys.splice(0))
      }
    }
    if (keys.length > 0) {
      deletedCount += await client.del(keys)
    }
  }

  return deletedCount
}

function buildCandidateWhere(
  options: Readonly<Pick<CliOptions, 'force' | 'gameId'>>,
  afterId?: number,
): Prisma.GameWhereInput {
  return {
    deletedAt: null,
    vndbId: { not: null },
    ...(!options.force ? { vndbTagsSyncedAt: null } : {}),
    ...((options.gameId !== undefined || afterId !== undefined)
      ? {
          id: {
            ...(options.gameId !== undefined ? { equals: options.gameId } : {}),
            ...(afterId !== undefined ? { gt: afterId } : {}),
          },
        }
      : {}),
  }
}

function loadLocalEnvironment() {
  const envPath = resolve(process.cwd(), '.env')
  if (existsSync(envPath)) loadEnvFile(envPath)
}

async function invalidateBackfillRedisCaches(redisUrl: string): Promise<number> {
  const { createClient } = await import('redis')
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: false,
    },
  })
  let clientError: unknown
  let deletedCount = 0
  client.on('error', (error) => {
    clientError ??= error
  })

  try {
    await client.connect()
    deletedCount = await deleteBackfillCacheKeys({
      scanIterator: options => client.scanIterator(options),
      del: keys => client.del(keys),
    })
  } finally {
    if (client.isOpen) await client.quit()
  }

  if (clientError) throw clientError
  return deletedCount
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as {
      code?: string
      message?: string
      statusMessage?: string
      data?: { message?: string; statusMessage?: string }
    }
    if (candidate.code === 'P2021' || candidate.code === 'P2022') {
      return '数据库尚未应用 VNDB 标签迁移，请先运行 pnpm db:migrate'
    }
    return candidate.data?.message
      || candidate.data?.statusMessage
      || candidate.statusMessage
      || candidate.message
      || '未知错误'
  }
  return String(error || '未知错误')
}

function sleep(milliseconds: number) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds))
}

async function main() {
  let options: CliOptions
  try {
    options = parseCliOptions(process.argv.slice(2))
  } catch (error) {
    console.error(`参数错误：${getErrorMessage(error)}`)
    usage()
    process.exitCode = 2
    return
  }

  if (options.help) {
    usage()
    return
  }

  loadLocalEnvironment()

  const [
    { default: prisma },
    { fetchVndbGame },
    {
      hasVndbGameNsfwSignal,
      isAdultVndbTag,
      normalizeVndbTags,
      selectEligibleCanonicalTagIds,
      syncVndbTagsForGame,
    },
  ] = await Promise.all([
    import('../server/utils/prisma'),
    import('../server/utils/vndb-client'),
    import('../server/utils/vndb-tag-sync'),
  ])

  const candidateSelect = {
    id: true,
    vndbId: true,
    titleZhHans: true,
    titleZhHant: true,
    titleJa: true,
    titleEn: true,
  } satisfies Prisma.GameSelect

  try {
    const candidateCount = await prisma.game.count({
      where: buildCandidateWhere(options, options.afterId),
    })
    const plannedCount = Math.min(candidateCount, options.limit ?? candidateCount)

    const modeLabel = options.apply ? 'APPLY（写入）' : 'DRY-RUN（只读）'
    console.log(`模式：${modeLabel}`)
    console.log(`候选：${candidateCount} 个，本次计划：${plannedCount} 个`)
    console.log(`范围：${options.force ? '全部符合条件的 VNDB 游戏' : '尚未成功同步 VNDB 标签的游戏'}`)
    console.log(`分页：按游戏 ID 升序，每批最多 ${options.batchSize} 个`)
    console.log(`请求间隔：${options.intervalMs}ms`)
    if (options.gameId !== undefined) console.log(`指定游戏：#${options.gameId}`)
    if (options.afterId !== undefined) console.log(`起始游标：id > ${options.afterId}`)
    if (options.limit !== undefined) console.log(`本次总量上限：${options.limit}`)
    console.log('')

    if (plannedCount === 0) {
      if (options.gameId !== undefined) {
        const target = await prisma.game.findUnique({
          where: { id: options.gameId },
          select: { deletedAt: true, vndbId: true, vndbTagsSyncedAt: true },
        })
        if (!target) console.log('指定游戏不存在。')
        else if (target.deletedAt) console.log('指定游戏已软删除，不会处理。')
        else if (!target.vndbId) console.log('指定游戏没有 VNDB ID，不会处理。')
        else if (target.vndbTagsSyncedAt && !options.force) {
          console.log('指定游戏已有同步时间；如需重抓，请增加 --force。')
        }
      } else {
        console.log('没有需要回填的游戏。')
      }
      return
    }

    const failures: FailedGame[] = []
    let succeeded = 0
    let totalRawTags = 0
    let totalAppliedTags = 0
    let totalPendingTags = 0
    let nsfwSuggestions = 0
    let cacheInvalidationFailed = false

    async function previewTags(tags: Parameters<typeof normalizeVndbTags>[0]): Promise<PreviewResult> {
      const normalized = normalizeVndbTags(tags)
      const ids = normalized.map(tag => tag.id)
      const storedTags = ids.length > 0
        ? await prisma.vndbTag.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              tagId: true,
              status: true,
              displayTier: true,
              isNsfw: true,
              affectsGameNsfw: true,
              tag: { select: { isNsfw: true, archivedAt: true } },
            },
          })
        : []
      const storedById = new Map(storedTags.map(tag => [tag.id, tag]))
      const candidates = normalized.map(tag => {
        const stored = storedById.get(tag.id)
        const knownAdult = isAdultVndbTag(tag)
        return {
          vndbTagId: tag.id,
          tagId: stored?.tagId ?? null,
          status: stored?.status ?? VndbTagStatus.PENDING,
          displayTier: stored?.displayTier ?? TagDisplayTier.PRIMARY,
          rating: tag.rating,
          spoiler: tag.spoiler,
          isNsfw: stored?.isNsfw ?? knownAdult,
          affectsGameNsfw: stored?.affectsGameNsfw ?? knownAdult,
          canonicalTagIsNsfw: stored?.tag?.isNsfw ?? false,
          canonicalTagArchivedAt: stored?.tag?.archivedAt ?? null,
        }
      })
      const appliedTagIds = selectEligibleCanonicalTagIds(candidates)

      return {
        rawTagCount: normalized.length,
        appliedTagCount: appliedTagIds.length,
        pendingTagCount: candidates.filter(candidate => (
          candidate.status === VndbTagStatus.PENDING
          || (candidate.status === VndbTagStatus.MAPPED && candidate.tagId === null)
        )).length,
        ignoredTagCount: candidates.filter(candidate => candidate.status === VndbTagStatus.IGNORED).length,
        suggestsGameNsfw: hasVndbGameNsfwSignal(candidates),
      }
    }

    let paginationState: CursorPaginationState = {
      afterId: options.afterId,
      processed: 0,
    }
    let batchNumber = 0
    let stopRequested = false
    let interrupted = false

    const requestStop = (signal: 'SIGINT' | 'SIGTERM') => {
      interrupted = true
      stopRequested = true
      console.warn(`\n收到 ${signal}，将在当前游戏处理完成后安全停止。`)
    }
    const onSigint = () => requestStop('SIGINT')
    const onSigterm = () => requestStop('SIGTERM')
    process.once('SIGINT', onSigint)
    process.once('SIGTERM', onSigterm)

    try {
      while (!stopRequested) {
        const pageRequest = getNextCursorPageRequest(paginationState, {
          batchSize: options.batchSize,
          limit: plannedCount,
        })
        if (!pageRequest) break

        const games = await prisma.game.findMany({
          where: buildCandidateWhere(options, pageRequest.afterId),
          select: candidateSelect,
          orderBy: { id: 'asc' },
          take: pageRequest.take,
        })
        if (games.length === 0) {
          if (paginationState.processed < plannedCount) {
            console.warn('候选集合在执行期间发生变化，已处理完当前仍符合条件的游戏。')
          }
          break
        }

        batchNumber++
        console.log(
          `批次 ${batchNumber}：读取 ${games.length} 个，ID ${games[0].id} - ${games[games.length - 1].id}`,
        )
        const processedIds: number[] = []

        for (let index = 0; index < games.length; index++) {
          if (stopRequested) break

          const game = games[index]
          const vndbId = game.vndbId
          const title = game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || `游戏 #${game.id}`
          const position = paginationState.processed + processedIds.length + 1
          const prefix = `[${position}/${plannedCount}] #${game.id} ${vndbId || '-'} ${title}`

          if (!vndbId) {
            failures.push({ gameId: game.id, vndbId: '-', message: '游戏没有 VNDB ID' })
            console.error(`${prefix}：跳过（游戏没有 VNDB ID）`)
          } else {
            try {
              const upstream = await fetchVndbGame(vndbId)
              // The helper owns a separate short transaction for this game.
              const result = options.apply
                ? await syncVndbTagsForGame({
                    gameId: game.id,
                    tags: upstream.tags,
                    expectedVndbId: vndbId,
                  })
                : await previewTags(upstream.tags)

              const rawTagCount = result.rawTagCount
              const appliedTagCount = 'appliedTagIds' in result
                ? result.appliedTagIds.length
                : result.appliedTagCount
              const pendingTagCount = 'pendingVndbTagIds' in result
                ? result.pendingVndbTagIds.length
                : result.pendingTagCount
              const ignoredTagCount = 'ignoredVndbTagIds' in result
                ? result.ignoredVndbTagIds.length
                : result.ignoredTagCount

              succeeded++
              totalRawTags += rawTagCount
              totalAppliedTags += appliedTagCount
              totalPendingTags += pendingTagCount
              if (result.suggestsGameNsfw) nsfwSuggestions++

              console.log(
                `${prefix}：${options.apply ? '已同步' : '预计'}原始 ${rawTagCount}，`
                + `应用中文 ${appliedTagCount}，待映射 ${pendingTagCount}，忽略 ${ignoredTagCount}`
                + (result.suggestsGameNsfw ? '，有游戏 NSFW 信号' : ''),
              )
            } catch (error) {
              const message = getErrorMessage(error)
              failures.push({ gameId: game.id, vndbId, message })
              console.error(`${prefix}：失败（${message}）`)
            }
          }

          processedIds.push(game.id)
          const processedCount = paginationState.processed + processedIds.length
          const moreInLoadedPage = index < games.length - 1
          const mayHaveNextPage = games.length === pageRequest.take && processedCount < plannedCount
          if (!stopRequested && (moreInLoadedPage || mayHaveNextPage)) {
            await sleep(options.intervalMs)
          }
        }

        paginationState = advanceCursorPagination(paginationState, processedIds)
        if (processedIds.length > 0) {
          console.log(
            `批次 ${batchNumber} 完成：累计 ${paginationState.processed}/${plannedCount}，`
            + `扫描游标 #${paginationState.afterId}，失败 ${failures.length}`,
          )
          console.log('')
        }

        if (processedIds.length < games.length || games.length < pageRequest.take) break
      }
    } finally {
      process.off('SIGINT', onSigint)
      process.off('SIGTERM', onSigterm)
    }

    if (options.apply && succeeded > 0) {
      const redisUrl = process.env.REDIS_URL?.trim()
      if (!redisUrl) {
        console.log('缓存：未配置 REDIS_URL，跳过 Redis 缓存失效。')
      } else {
        try {
          const deletedCount = await invalidateBackfillRedisCaches(redisUrl)
          console.log(`缓存：已统一删除 ${deletedCount} 个游戏与标签相关 Redis 键。`)
        } catch (error) {
          cacheInvalidationFailed = true
          console.error(`缓存失效失败（已写入的数据不会回滚）：${getErrorMessage(error)}`)
        }
      }
    }

    console.log('')
    console.log('汇总')
    console.log(`  已处理：${paginationState.processed}/${plannedCount}`)
    console.log(`  完成批次：${batchNumber}`)
    console.log(`  成功：${succeeded}`)
    console.log(`  失败：${failures.length}`)
    console.log(`  原始标签：${totalRawTags}`)
    console.log(`  可应用中文标签：${totalAppliedTags}`)
    console.log(`  待映射标签：${totalPendingTags}`)
    console.log(`  游戏 NSFW 信号：${nsfwSuggestions}`)
    if (paginationState.afterId !== undefined) {
      console.log(`  最后扫描游标：#${paginationState.afterId}`)
    }

    if (!options.apply) {
      console.log('  数据库写入：0（dry-run）')
      console.log('')
      console.log('确认结果后增加 --apply 执行写入。')
    }

    if (interrupted && paginationState.afterId !== undefined && failures.length === 0) {
      console.warn('')
      const remainingCount = plannedCount - paginationState.processed
      if (remainingCount > 0) {
        const remainingLimit = options.limit !== undefined ? ` --limit ${remainingCount}` : ''
        console.warn(
          `任务已安全停止。可将续跑参数设为 --after-id ${paginationState.afterId}${remainingLimit}。`,
        )
      } else {
        console.warn('任务已安全停止，停止前已完成本次计划数量。')
      }
    }

    if (failures.length > 0) {
      console.error('')
      console.error('失败明细')
      for (const failure of failures) {
        console.error(`  #${failure.gameId} ${failure.vndbId}: ${failure.message}`)
      }
      console.error('失败游戏未写入同步时间；请不带 --after-id 重跑，或用 --game-id 逐项重试。')
    }

    if (failures.length > 0 || cacheInvalidationFailed) {
      process.exitCode = 1
    } else if (interrupted) {
      process.exitCode = 130
    }
  } finally {
    await prisma.$disconnect()
  }
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  main().catch((error) => {
    console.error(`回填中止：${getErrorMessage(error)}`)
    process.exitCode = 1
  })
}

import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { recordActivity } from '~/server/utils/activity'

const VALID_STATUSES = ['WISHLIST', 'PLAYING', 'COMPLETED', 'ON_HOLD', 'DROPPED'] as const
const LEGACY_STATUS_MAP = {
  NOT_PLAYED: 'WISHLIST',
  PLAYED: 'COMPLETED',
} as const

type FavoriteStatus = typeof VALID_STATUSES[number]
type LegacyFavoriteStatus = keyof typeof LEGACY_STATUS_MAP

function normalizeStatus(status: unknown): FavoriteStatus | null | undefined {
  if (status === null) return null
  if (typeof status !== 'string') return undefined
  if (VALID_STATUSES.includes(status as FavoriteStatus)) return status as FavoriteStatus
  return LEGACY_STATUS_MAP[status as LegacyFavoriteStatus]
}

function parseOptionalDate(value: unknown, label: string): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: `${label}格式无效` })
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, message: `${label}格式无效` })
  }
  return date
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const body = await readBody(event).catch(() => ({}))
  const status = normalizeStatus(body?.status ?? null)

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  // status 为 null → 取消收藏
  if (status === null) {
    await prisma.favorite.deleteMany({
      where: { gameId, userId: user.id },
    })
    return { isFavorited: false, favoriteStatus: null, message: '已取消收藏' }
  }

  if (!status) {
    throw createError({ statusCode: 400, message: '无效的收藏状态' })
  }

  const note = typeof body?.note === 'string' ? body.note.trim() || null : undefined
  const startedAt = parseOptionalDate(body?.startedAt, '开始时间')
  const completedAt = parseOptionalDate(body?.completedAt, '完成时间')

  const existing = await prisma.favorite.findUnique({
    where: { gameId_userId: { gameId, userId: user.id } },
  })
  const isNew = !existing
  const statusChanged = existing?.status !== status

  const extraData = {
    ...(note !== undefined ? { note } : {}),
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(completedAt !== undefined ? { completedAt } : {}),
  }

  await prisma.favorite.upsert({
    where: { gameId_userId: { gameId, userId: user.id } },
    update: {
      status,
      ...(statusChanged ? { statusUpdatedAt: new Date() } : {}),
      ...extraData,
    },
    create: {
      gameId,
      userId: user.id,
      status,
      statusUpdatedAt: new Date(),
      ...extraData,
    },
  })

  if (isNew) {
    recordActivity({
      userId: user.id,
      type: 'FAVORITE_GAME',
      targetType: 'game',
      targetId: gameId,
      meta: {
        gameTitle: game.titleZhHans || game.titleJa || game.titleEn,
        gameCover: game.coverImage,
      },
    })
  }

  const labels: Record<FavoriteStatus, string> = {
    WISHLIST: '已加入「想玩」',
    PLAYING: '已加入「在玩」',
    COMPLETED: '已加入「玩过」',
    ON_HOLD: '已加入「搁置」',
    DROPPED: '已加入「抛弃」',
  }

  return { isFavorited: true, favoriteStatus: status, message: labels[status] }
})

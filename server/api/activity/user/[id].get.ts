import { z } from 'zod'
import prisma from '~/server/utils/prisma'

async function getValidActivityIds() {
  const [games, comments, guides] = await Promise.all([
    prisma.game.findMany({ where: { deletedAt: null }, select: { id: true } }),
    prisma.comment.findMany({ where: { deletedAt: null, game: { deletedAt: null } }, select: { id: true } }),
    prisma.guide.findMany({ where: { game: { deletedAt: null } }, select: { id: true } }),
  ])

  return {
    gameIds: new Set(games.map(item => item.id)),
    commentIds: new Set(comments.map(item => item.id)),
    guideIds: new Set(guides.map(item => item.id)),
  }
}

function getActivityMetaId(meta: unknown, key: string) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const value = (meta as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

function isActivityStillValid(
  activity: { type: string; targetType: string | null; targetId: number | null; meta: unknown },
  validIds: { gameIds: Set<number>; commentIds: Set<number>; guideIds: Set<number> },
) {
  if (!activity.targetId) return false
  if (['CREATE_GAME', 'EDIT_GAME', 'RATE_GAME', 'FAVORITE_GAME'].includes(activity.type)) {
    return activity.targetType === 'game' && validIds.gameIds.has(activity.targetId)
  }
  if (activity.type === 'COMMENT') {
    const commentId = getActivityMetaId(activity.meta, 'commentId')
    return activity.targetType === 'game'
      ? validIds.gameIds.has(activity.targetId) && (!commentId || validIds.commentIds.has(commentId))
      : validIds.commentIds.has(activity.targetId)
  }
  if (['CREATE_GUIDE', 'EDIT_GUIDE'].includes(activity.type)) {
    return activity.targetType === 'guide' && validIds.guideIds.has(activity.targetId)
  }
  return false
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const userId = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(userId)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const { page, limit, type } = querySchema.parse(getQuery(event))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { userId }
  if (type) {
    const types = type.split(',')
    where.type = types.length > 1 ? { in: types } : types[0]
  }

  const items = await prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

  const validActivityIds = await getValidActivityIds()
  const validItems = items.filter(item => isActivityStillValid(item, validActivityIds))
  const pageItems = validItems.slice(skip, skip + limit)
  const totalValidItems = validItems.length

  return {
    items: pageItems,
    pagination: {
      page,
      limit,
      total: totalValidItems,
      totalPages: Math.ceil(totalValidItems / limit),
    },
  }
})

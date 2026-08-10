import { z } from 'zod'
import prisma from '~/server/utils/prisma'

function getActivityMetaId(meta: unknown, key: string) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const value = (meta as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export default defineEventHandler(async (event) => {
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的游戏ID' })
  }

  const game = await prisma.game.findUnique({ where: { id: gameId, deletedAt: null }, select: { id: true } })
  if (!game) {
    throw createError({ statusCode: 404, message: '游戏不存在' })
  }

  const { page, limit } = querySchema.parse(getQuery(event))
  const skip = (page - 1) * limit

  const where = { targetType: 'game', targetId: gameId }

  const items = await prisma.activity.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const commentIds = items
    .filter(item => item.type === 'COMMENT')
    .map(item => getActivityMetaId(item.meta, 'commentId'))
    .filter((id): id is number => typeof id === 'number')
  const validComments = commentIds.length > 0
    ? await prisma.comment.findMany({
        where: { id: { in: commentIds }, deletedAt: null },
        select: { id: true },
      })
    : []
  const validCommentIds = new Set(validComments.map(comment => comment.id))
  const validItems = items.filter(item => {
    if (item.type !== 'COMMENT') return true
    const commentId = getActivityMetaId(item.meta, 'commentId')
    return !commentId || validCommentIds.has(commentId)
  })
  const pageItems = validItems.slice(skip, skip + limit)
  const total = validItems.length

  return {
    items: pageItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

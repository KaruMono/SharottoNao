import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const commentId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(commentId)) {
    throw createError({ statusCode: 400, message: '无效的评论ID' })
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { userId: true, gameId: true, parentId: true },
  })

  if (!comment) {
    throw createError({ statusCode: 404, message: '评论不存在' })
  }

  // 只有作者或管理员可以删除
  if (comment.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: '无权删除此评论' })
  }

  // 软删除；删除顶级评论时同步隐藏它的回复，避免留下不可见但仍被计数的孤儿回复。
  const deletedAt = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: { deletedAt },
    })

    if (!comment.parentId) {
      await tx.comment.updateMany({
        where: { parentId: commentId, deletedAt: null },
        data: { deletedAt },
      })
    }
  })

  invalidateGameCaches(comment.gameId).catch(() => {})
  invalidateCache('user:*').catch(() => {})

  return { success: true }
})

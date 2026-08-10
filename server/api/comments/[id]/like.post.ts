import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sendNotification, shouldSendMilestoneNotification } from '~/server/utils/notification'
import { getDisplayTitle } from '~/server/utils/game'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const commentId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(commentId)) {
    throw createError({ statusCode: 400, message: '无效的评论ID' })
  }

  const userId = user.id

  // 检查评论是否存在
  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    include: { user: true, game: true },
  })

  if (!comment || comment.game.deletedAt) {
    throw createError({ statusCode: 404, message: '评论不存在' })
  }

  // 检查是否已点赞
  const existingLike = await prisma.commentLike.findUnique({
    where: {
      commentId_userId: {
        commentId,
        userId,
      },
    },
  })

  let liked = false
  let likeCount: number

  if (existingLike) {
    // 删除点赞记录与减少计数放在同一事务，避免并发下计数漂移
    const [, updated] = await prisma.$transaction([
      prisma.commentLike.delete({
        where: { id: existingLike.id },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      }),
    ])
    likeCount = Math.max(0, updated.likeCount)
  } else {
    try {
      const [, updated] = await prisma.$transaction([
        prisma.commentLike.create({
          data: {
            commentId,
            userId,
          },
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        }),
      ])
      likeCount = updated.likeCount
    } catch (e: any) {
      // 并发重复点赞触发唯一约束冲突，按已点赞幂等处理
      if (e?.code === 'P2002') {
        const current = await prisma.comment.findUnique({
          where: { id: commentId },
          select: { likeCount: true },
        })
        return { liked: true, likeCount: current?.likeCount ?? comment.likeCount }
      }
      throw e
    }
    liked = true

    if (comment.userId !== userId && shouldSendMilestoneNotification(likeCount)) {
      await sendNotification({
        senderId: userId,
        receiverId: comment.userId,
        type: 'COMMENT_LIKE',
        title: '评论点赞里程碑',
        content: `恭喜！你在「${getDisplayTitle(comment.game)}」的评论获得了第 ${likeCount} 个赞`,
        relatedUrl: `/games/${comment.gameId}`,
      })
    }
  }

  return { liked, likeCount }
})

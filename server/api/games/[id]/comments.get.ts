import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { parseEmojis } from '~/server/utils/emoji'
import { isEffectivelyEmptyHtml } from '~/server/utils/html'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  sort: z.enum(['latest', 'oldest', 'likes']).default('latest'),
})

export default defineEventHandler(async (event) => {
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const query = getQuery(event)
  const { page, limit, sort } = querySchema.parse(query)
  const user = await getAuthUser(event)
  const skip = (page - 1) * limit

  // 构建排序
  const orderBy: any = sort === 'latest' ? { createdAt: 'desc' }
    : sort === 'oldest' ? { createdAt: 'asc' }
    : { likeCount: 'desc' }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: {
        gameId,
        parentId: null, // 只获取顶级评论
        deletedAt: null, // 排除软删除
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true, title: true, titleColor: true },
        },
        replies: {
          where: { deletedAt: null },
          include: {
            user: {
              select: { id: true, username: true, avatar: true, title: true, titleColor: true },
            },
            _count: {
              select: { likes: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.comment.count({
      where: {
        gameId,
        parentId: null,
        deletedAt: null,
      },
    }),
  ])

  // 获取用户点赞状态
  let likedCommentIds = new Set<number>()
  if (user) {
    const allCommentIds = [
      ...comments.map(c => c.id),
      ...comments.flatMap(c => c.replies.map(r => r.id)),
    ]
    const userLikes = await prisma.commentLike.findMany({
      where: {
        userId: user.id,
        commentId: { in: allCommentIds },
      },
      select: { commentId: true },
    })
    likedCommentIds = new Set(userLikes.map(l => l.commentId))
  }

  // 添加点赞状态并解析表情
  // 同时过滤历史遗留的“空壳评论”（内容实质为空，只会渲染出头像和用户名）
  const commentsWithStatus = (await Promise.all(comments.map(async comment => {
    const replies = (await Promise.all(comment.replies.map(async reply => ({
      ...reply,
      content: await parseEmojis(reply.content),
      isLiked: likedCommentIds.has(reply.id),
      likeCount: (reply as any)._count?.likes || 0,
    })))).filter(reply => !isEffectivelyEmptyHtml(reply.content))

    const content = await parseEmojis(comment.content)

    if (isEffectivelyEmptyHtml(content) && replies.length === 0) {
      return null
    }

    return {
      ...comment,
      content,
      isLiked: likedCommentIds.has(comment.id),
      likeCount: (comment as any)._count?.likes || 0,
      replies,
    }
  }))).filter((c): c is NonNullable<typeof c> => c !== null)

  return {
    items: commentsWithStatus,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sanitizeHtml, validateHtml, isEffectivelyEmptyHtml } from '~/server/utils/html'
import { checkWriteRateLimit } from '~/server/utils/rate-limit'
import { sendNotification } from '~/server/utils/notification'
import { getDisplayTitle } from '~/server/utils/game'
import { recordActivity } from '~/server/utils/activity'
import { filterLinks, hasNonWhitelistedLinks } from '~/server/utils/link-filter'

const schema = z.object({
  content: z.string().min(1, '请输入评论内容').max(10000, '评论内容过长'),
  playTime: z.number().min(0).max(48).nullable().optional(),
  parentId: z.number().optional(), // 父评论ID，用于回复
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await checkWriteRateLimit(event, user.id)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const { content, playTime, parentId } = schema.parse(body)
  
  if (isNaN(gameId)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  // 验证 HTML
  const htmlValidation = validateHtml(content)
  if (!htmlValidation.valid) {
    throw createError({
      statusCode: 400,
      message: htmlValidation.error || '内容格式错误',
    })
  }

  // 清理 HTML
  let cleanContent = sanitizeHtml(content)
  
  // 过滤链接（移除非白名单链接）
  if (hasNonWhitelistedLinks(cleanContent)) {
    cleanContent = filterLinks(cleanContent, 'whitelist')
  }

  // 清理后若内容实质为空（如仅有 <p></p> 空标签），拒绝创建，
  // 否则会入库并渲染成只有头像和用户名、没有正文的空评论
  if (isEffectivelyEmptyHtml(cleanContent)) {
    throw createError({ statusCode: 400, message: '请输入评论内容' })
  }

  // 如果是回复，检查父评论是否存在
  let parentComment = null
  if (parentId) {
    parentComment = await prisma.comment.findUnique({
      where: { id: parentId, deletedAt: null },
      include: { user: true },
    })
    if (!parentComment || parentComment.gameId !== gameId) {
      throw createError({
        statusCode: 400,
        message: '父评论不存在',
      })
    }
  }

  // 创建评论
  const comment = await prisma.comment.create({
    data: {
      gameId,
      userId: user.id,
      content: cleanContent,
      playTime: playTime || null,
      parentId: parentId || null,
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  })

  // 如果是回复，发送通知中心消息给被回复的用户（不通知自己）
  if (parentComment && parentComment.userId !== user.id) {
    await sendNotification({
      senderId: user.id,
      receiverId: parentComment.userId,
      type: 'COMMENT_REPLY',
      title: '收到新的回复',
      content: `${user.username} 回复了你在「${getDisplayTitle(game)}」的评论`,
      relatedUrl: `/games/${gameId}?comment=${comment.id}`,
    })
  }

  // 记录活动（仅顶级评论）
  if (!parentId) {
    recordActivity({
      userId: user.id,
      type: 'COMMENT',
      targetType: 'game',
      targetId: gameId,
      meta: {
        gameTitle: getDisplayTitle(game),
        commentId: comment.id,
      },
    })
  }

  return comment
})

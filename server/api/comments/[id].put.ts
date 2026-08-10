import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sanitizeHtml, validateHtml, isEffectivelyEmptyHtml } from '~/server/utils/html'
import { filterLinks, hasNonWhitelistedLinks } from '~/server/utils/link-filter'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

const schema = z.object({
  content: z.string().min(1, '请输入评论内容').max(10000, '评论内容过长'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const commentId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(commentId)) {
    throw createError({ statusCode: 400, message: '无效的评论ID' })
  }

  const body = await readBody(event)
  const { content } = schema.parse(body)

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { userId: true, createdAt: true, gameId: true, game: { select: { deletedAt: true } } },
  })

  if (!comment || comment.game.deletedAt) {
    throw createError({ statusCode: 404, message: '评论不存在' })
  }

  // 只有作者可以编辑（管理员不能编辑他人评论）
  if (comment.userId !== user.id) {
    throw createError({ statusCode: 403, message: '无权编辑此评论' })
  }

  // 检查是否超过编辑时限（24小时内可编辑）
  const editDeadline = new Date(comment.createdAt.getTime() + 24 * 60 * 60 * 1000)
  if (new Date() > editDeadline) {
    throw createError({ statusCode: 403, message: '评论发布超过24小时，无法编辑' })
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

  // 清理后若内容实质为空，拒绝更新，避免把评论编辑成空壳
  if (isEffectivelyEmptyHtml(cleanContent)) {
    throw createError({ statusCode: 400, message: '请输入评论内容' })
  }

  // 更新评论
  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: {
      content: cleanContent,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  })

  invalidateGameCaches(comment.gameId).catch(() => {})
  invalidateCache('user:*').catch(() => {})

  return updatedComment
})

import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import { checkWriteRateLimit } from '~/server/utils/rate-limit'

const schema = z.object({
  type: z.enum(['COMMENT', 'RESOURCE', 'GUIDE']),
  targetId: z.number(),
  reason: z.string().trim().min(1).max(255),
  detail: z.string().trim().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await checkWriteRateLimit(event, user.id)

  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  const { type, targetId, reason, detail } = result.data
  if (reason === '其他' && !detail) {
    throw createError({ statusCode: 400, message: '选择“其他”时，请填写具体举报理由' })
  }
  const userId = user.id

  // 检查目标是否存在
  if (type === 'COMMENT') {
    const comment = await prisma.comment.findUnique({ where: { id: targetId, deletedAt: null } })
    if (!comment) {
      throw createError({ statusCode: 404, message: '评论不存在' })
    }

    // 检查是否已举报过
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        commentId: targetId,
        status: 'PENDING',
      },
    })
    if (existingReport) {
      throw createError({ statusCode: 400, message: '您已举报过该评论，请等待处理' })
    }

    await prisma.report.create({
      data: {
        type: 'COMMENT',
        reason,
        detail,
        reporterId: userId,
        commentId: targetId,
      },
    })
  } else if (type === 'RESOURCE') {
    const resource = await prisma.resource.findUnique({ where: { id: targetId, deletedAt: null } })
    if (!resource) {
      throw createError({ statusCode: 404, message: '资源不存在' })
    }

    // 检查是否已举报过
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        resourceId: targetId,
        status: 'PENDING',
      },
    })
    if (existingReport) {
      throw createError({ statusCode: 400, message: '您已举报过该资源，请等待处理' })
    }

    await prisma.report.create({
      data: {
        type: 'RESOURCE',
        reason,
        detail,
        reporterId: userId,
        resourceId: targetId,
      },
    })
  } else {
    const guide = await prisma.guide.findUnique({
      where: { id: targetId },
      include: { game: { select: { deletedAt: true } } },
    })
    if (!guide || guide.game.deletedAt) {
      throw createError({ statusCode: 404, message: '攻略不存在' })
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        guideId: targetId,
        status: 'PENDING',
      },
    })
    if (existingReport) {
      throw createError({ statusCode: 400, message: '您已举报过该攻略，请等待处理' })
    }

    await prisma.report.create({
      data: {
        type: 'GUIDE',
        reason,
        detail,
        reporterId: userId,
        guideId: targetId,
      },
    })
  }

  return { success: true }
})

import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'

import { sendNotification } from '~/server/utils/notification'

const schema = z.object({
  action: z.enum(['delete', 'reject', 'edit']),
  handleNote: z.string().max(500).optional(),
  resourceData: z.object({
    title: z.string().optional(),
    url: z.string().optional(),
    extractCode: z.string().nullable().optional(),
    unzipPassword: z.string().nullable().optional(),
  }).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  
  const reportId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(reportId)) {
    throw createError({ statusCode: 400, message: '无效的举报ID' })
  }

  const body = await readBody(event)
  const { action, handleNote, resourceData } = schema.parse(body)

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      comment: true,
      resource: true,
      guide: true,
      reporter: { select: { id: true, username: true } },
    },
  })

  if (!report) {
    throw createError({ statusCode: 404, message: '举报不存在' })
  }

  if (report.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: '该举报已处理' })
  }

  const targetGameId = report.type === 'COMMENT'
    ? report.comment?.gameId
    : report.type === 'RESOURCE'
      ? report.resource?.gameId
      : report.guide?.gameId

  // 根据操作类型处理
  if (action === 'delete') {
    // 删除被举报的内容
    if (report.type === 'COMMENT' && report.commentId) {
      await prisma.comment.update({ where: { id: report.commentId }, data: { deletedAt: new Date() } })
    } else if (report.type === 'RESOURCE' && report.resourceId) {
      await prisma.resource.update({ where: { id: report.resourceId }, data: { deletedAt: new Date() } })
    } else if (report.type === 'GUIDE' && report.guideId) {
      await prisma.guide.delete({ where: { id: report.guideId } })
    }

    if (targetGameId) {
      invalidateGameCaches(targetGameId).catch(() => {})
    } else {
      invalidateGameCaches().catch(() => {})
    }
    invalidateCache('user:*').catch(() => {})

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'RESOLVED',
        handledById: user.id,
        handleNote: handleNote || '已删除内容',
        handledAt: new Date(),
      },
    })
  } else if (action === 'reject') {
    // 驳回举报
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'REJECTED',
        handledById: user.id,
        handleNote: handleNote || '举报不成立',
        handledAt: new Date(),
      },
    })
  } else if (action === 'edit' && resourceData && report.resourceId) {
    const resourceId = report.resourceId
    // 修改资源
    await prisma.$transaction(async (tx) => {
      await tx.resource.update({
        where: { id: resourceId },
        data: {
          ...resourceData,
          healthStatus: 'AVAILABLE',
          healthNote: handleNote || '举报处理后已更新资源信息',
          healthCheckedAt: new Date(),
          issueCount: 0,
        },
      })

      await tx.resourceHealthFeedback.deleteMany({
        where: { resourceId },
      })

      await tx.report.update({
        where: { id: reportId },
        data: {
          status: 'RESOLVED',
          handledById: user.id,
          handleNote: handleNote || '已修改资源',
          handledAt: new Date(),
        },
      })
    })

    if (targetGameId) {
      invalidateGameCaches(targetGameId).catch(() => {})
    }
  }

  // 处理结果通知（通知中心）
  if (report.reporterId !== user.id) {
    const targetTypeText = report.type === 'COMMENT' ? '评论' : report.type === 'RESOURCE' ? '资源' : '攻略'
    const actionText = action === 'delete'
      ? '已删除被举报内容'
      : action === 'reject'
        ? '已驳回该举报'
        : '已修改被举报资源'

    await sendNotification({
      receiverId: report.reporterId,
      type: 'SYSTEM',
      title: '举报处理结果通知',
      content: `您提交的${targetTypeText}举报已处理。\n\n处理结果：${actionText}${handleNote ? `\n\n备注：${handleNote}` : ''}`,
      relatedUrl: targetGameId ? `/games/${targetGameId}` : '/messages',
    })
  }

  await logAdminOperation({
    adminId: user.id,
    action: 'HANDLE_REPORT',
    targetType: 'Report',
    targetId: reportId,
    content: `type=${report.type}; action=${action}; note=${handleNote || ''}; targetId=${report.type === 'COMMENT' ? report.commentId : report.type === 'RESOURCE' ? report.resourceId : report.guideId}`,
  })

  return { success: true }
})

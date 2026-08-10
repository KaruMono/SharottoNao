import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { invalidateGameCaches } from '~/server/utils/redis'
import { sendNotification } from '~/server/utils/notification'
import prisma from '~/server/utils/prisma'

const bodySchema = z.object({
  healthStatus: z.enum(['AVAILABLE', 'NEEDS_REVIEW', 'SUSPECTED_BAD', 'UNAVAILABLE']),
  healthNote: z.string().max(1000).optional().nullable(),
  clearIssueCount: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const resourceId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(resourceId)) {
    throw createError({ statusCode: 400, message: '无效的资源ID' })
  }

  const body = await readBody(event)
  const { healthStatus, healthNote, clearIssueCount } = bodySchema.parse(body)

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      title: true,
      gameId: true,
      uploaderId: true,
      healthStatus: true,
      game: {
        select: {
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
        },
      },
    },
  })
  if (!resource) {
    throw createError({ statusCode: 404, message: '资源不存在' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.resource.update({
      where: { id: resourceId },
      data: {
        healthStatus,
        healthNote: healthNote?.trim() || null,
        healthCheckedAt: new Date(),
        ...(clearIssueCount ? { issueCount: 0 } : {}),
      },
    })

    if (clearIssueCount) {
      await tx.resourceHealthFeedback.deleteMany({
        where: { resourceId },
      })
    }
  })

  await logAdminOperation({
    adminId: admin.id,
    action: 'UPDATE_RESOURCE_HEALTH',
    targetType: 'Resource',
    targetId: resourceId,
    content: `资源: ${resource.title}; 状态: ${resource.healthStatus} -> ${healthStatus}${healthNote ? `; 备注: ${healthNote}` : ''}`,
  })

  if (resource.uploaderId !== admin.id) {
    const gameTitle = resource.game.titleZhHans || resource.game.titleZhHant || resource.game.titleJa || resource.game.titleEn || `游戏 #${resource.gameId}`
    await sendNotification({
      receiverId: resource.uploaderId,
      type: 'RESOURCE_HEALTH',
      title: healthStatus === 'AVAILABLE' ? '资源已标记为可用' : '资源可用性状态已更新',
      content: `您在「${gameTitle}」上传的资源「${resource.title}」已被更新为「${healthStatus}」。${healthNote ? `\n\n备注：${healthNote}` : ''}`,
      relatedUrl: `/games/${resource.gameId}`,
    })
  }

  invalidateGameCaches(resource.gameId).catch(() => {})

  return { success: true }
})

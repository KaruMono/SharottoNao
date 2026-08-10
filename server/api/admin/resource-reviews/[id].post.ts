import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { updateMachineTranslationTag } from '~/server/utils/machine-translation-tag'
import { invalidateGameCaches } from '~/server/utils/redis'
import { detectNetDiskTypeId } from '~/server/utils/net-disk'
import { sendNotification } from '~/server/utils/notification'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const resourceId = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(resourceId)) {
    throw createError({ statusCode: 400, message: '无效的资源ID' })
  }
  
  const body = await readBody(event)
  const { action, note } = bodySchema.parse(body)
  
  // 获取资源信息
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      uploader: {
        select: { id: true, username: true },
      },
      game: {
        select: {
          id: true,
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
  
  if (resource.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: '该资源已处理' })
  }
  
  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
  
  // 更新资源状态
  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      status: newStatus,
      ...(resource.netDiskTypeId ? {} : { netDiskTypeId: await detectNetDiskTypeId(resource.url) }),
    },
  })
  
  // 获取游戏标题
  const gameTitle = resource.game?.titleZhHans || resource.game?.titleZhHant || 
                    resource.game?.titleJa || resource.game?.titleEn || `游戏 #${resource.gameId}`
  
  // 发送通知给上传者
  if (resource.uploaderId !== user.id) {
    await sendNotification({
      receiverId: resource.uploaderId,
      type: action === 'approve' ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
      title: action === 'approve' ? '资源审核通过' : '资源审核未通过',
      content: action === 'approve'
        ? `您在「${gameTitle}」上传的资源「${resource.title}」已通过审核，现在用户可以正常下载了。`
        : `您在「${gameTitle}」上传的资源「${resource.title}」未通过审核。${note ? `\n\n原因：${note}` : ''}`,
      relatedUrl: `/games/${resource.gameId}`,
    })
  }
  
  await logAdminOperation({
    adminId: user.id,
    action: action === 'approve' ? 'APPROVE_RESOURCE' : 'REJECT_RESOURCE',
    targetType: 'Resource',
    targetId: resourceId,
    content: `资源: ${resource.title}; 游戏: ${gameTitle}; 上传者: ${resource.uploader?.username || ''}(#${resource.uploaderId})${note ? `; 备注: ${note}` : ''}`,
  })

  // 如果审核通过且是机翻资源，更新机器翻译标签
  if (action === 'approve' && resource.isMachineTranslated) {
    updateMachineTranslationTag(resource.gameId).catch(err => {
      console.error('Failed to update machine translation tag:', err)
    })
  }

  invalidateGameCaches(resource.gameId).catch(() => {})

  return { success: true }
})

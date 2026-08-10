import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { invalidateGameCaches } from '~/server/utils/redis'
import { sendNotification } from '~/server/utils/notification'

const schema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireEditor(event)
  const body = await readBody(event)
  const { ids, action, note } = schema.parse(body)

  const status = action === 'approve' ? 'APPROVED' : 'REJECTED'

  const resources = await prisma.resource.findMany({
    where: {
      id: { in: ids },
      status: 'PENDING',
    },
    select: { uploaderId: true, title: true, gameId: true },
  })

  const result = await prisma.resource.updateMany({
    where: { 
      id: { in: ids },
      status: 'PENDING',
    },
    data: { 
      status,
    },
  })

  if (resources.length > 0) {
    await Promise.all(
      resources
        .filter(r => r.uploaderId !== admin.id)
        .map(r => sendNotification({
          receiverId: r.uploaderId,
          type: action === 'approve' ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
          title: action === 'approve' ? '资源审核通过' : '资源审核未通过',
          content: action === 'approve'
            ? `您上传的资源「${r.title}」已通过审核，现在用户可以正常下载了。`
            : `您上传的资源「${r.title}」未通过审核${note ? `\n\n原因：${note}` : ''}`,
          relatedUrl: `/games/${r.gameId}`,
        })),
    )
  }

  await logAdminOperation({
    adminId: admin.id,
    action: action === 'approve' ? 'BATCH_APPROVE_RESOURCES' : 'BATCH_REJECT_RESOURCES',
    targetType: 'Resource',
    content: `批量${action === 'approve' ? '通过' : '拒绝'} ${result.count} 个资源 ids=${ids.join(',')}${note ? `; 备注: ${note}` : ''}`,
  })

  await Promise.all([...new Set(resources.map(resource => resource.gameId))].map(gameId => invalidateGameCaches(gameId)))

  return { 
    success: true, 
    message: `已${action === 'approve' ? '通过' : '拒绝'} ${result.count} 个资源`,
    count: result.count,
  }
})

import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

const schema = z.object({
  ids: z.array(z.number()).min(1),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const { ids } = schema.parse(body)

  // 确保只删除已软删除的资源
  const result = await prisma.resource.deleteMany({
    where: {
      id: { in: ids },
      deletedAt: { not: null },
    },
  })

  await logAdminOperation({
    adminId: admin.id,
    action: 'PURGE_RESOURCES',
    targetType: 'Resource',
    content: `永久删除 ${result.count} 个已软删除资源 ids=${ids.join(',')}`,
  })

  return {
    success: true,
    message: `已永久删除 ${result.count} 个资源`,
    count: result.count,
  }
})

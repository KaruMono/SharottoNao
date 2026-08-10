import { z } from 'zod'
import { requireAdmin, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

const schema = z.object({
  ids: z.array(z.number()).min(1),
  status: z.enum(['ACTIVE', 'BANNED']),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const { ids, status } = schema.parse(body)

  // 过滤掉管理员自己
  const filteredIds = ids.filter(id => id !== admin.id)
  
  if (filteredIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: '没有可操作的用户',
    })
  }

  // 批量更新用户状态
  await prisma.user.updateMany({
    where: { id: { in: filteredIds } },
    data: { 
      status,
      tokenVersion: { increment: 1 },
    },
  })

  // 使所有被操作用户的 token 失效
  await Promise.all(filteredIds.map(id => invalidateUserTokens(id)))

  await logAdminOperation({
    adminId: admin.id,
    action: status === 'BANNED' ? 'BATCH_BAN_USERS' : 'BATCH_UNBAN_USERS',
    targetType: 'User',
    content: `批量${status === 'BANNED' ? '封禁' : '解封'} ${filteredIds.length} 个用户; ids=${filteredIds.join(',')}`,
  })

  return { 
    success: true, 
    message: `已${status === 'BANNED' ? '封禁' : '解封'} ${filteredIds.length} 个用户`,
    count: filteredIds.length,
  }
})

import { requireAdmin, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  // 递增 token 版本号，使所有旧 token 失效
  await prisma.user.update({
    where: { id },
    data: {
      tokenVersion: { increment: 1 },
    },
  })

  // 使该用户所有旧 token 失效
  await invalidateUserTokens(id)

  await logAdminOperation({
    adminId: admin.id,
    action: 'LOGOUT_ALL_SESSIONS',
    targetType: 'User',
    targetId: id,
    content: `注销全部会话: ${user.username}(#${id})`,
  })

  return { success: true, message: '已注销全部会话' }
})

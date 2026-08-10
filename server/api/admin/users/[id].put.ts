import { z } from 'zod'
import { requireAdmin, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { addIpToBlacklist } from '~/server/utils/ip-blacklist'

const schema = z.object({
  role: z.enum(['USER', 'EDITOR', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'BANNED']).optional(),
  blacklistIps: z.boolean().optional(), // 封禁时同时将用户 IP 加入黑名单
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  // 不能修改自己
  if (id === admin.id) {
    throw createError({
      statusCode: 400,
      message: '不能修改自己的权限',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(data.role && { role: data.role }),
      ...(data.status && { status: data.status }),
      // 角色或状态变更时递增 token 版本号
      tokenVersion: { increment: 1 },
    },
    select: { id: true, registrationIp: true, loginIps: true },
  })

  // 封禁时将 IP 加入黑名单
  if (data.status === 'BANNED' && data.blacklistIps) {
    const reason = `封禁用户 ${user.username}(#${id})`
    if (updatedUser.registrationIp) {
      await addIpToBlacklist(updatedUser.registrationIp, admin.id, reason)
    }
    const lastLoginIp = updatedUser.loginIps[0]
    if (lastLoginIp && lastLoginIp !== updatedUser.registrationIp) {
      await addIpToBlacklist(lastLoginIp, admin.id, reason)
    }
  }

  // 使该用户所有旧 token 失效
  await invalidateUserTokens(id)

  const parts: string[] = []
  if (data.role) parts.push(`role: ${user.role} -> ${data.role}`)
  if (data.status) parts.push(`status: ${user.status} -> ${data.status}`)

  await logAdminOperation({
    adminId: admin.id,
    action: data.status === 'BANNED' ? 'BAN_USER' : data.status === 'ACTIVE' ? 'UNBAN_USER' : 'UPDATE_USER',
    targetType: 'User',
    targetId: id,
    content: `用户: ${user.username}(#${id}); ${parts.join('; ')}`,
  })

  return { success: true, message: '更新成功' }
})

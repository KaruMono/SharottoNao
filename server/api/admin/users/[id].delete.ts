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

  if (id === admin.id) {
    throw createError({
      statusCode: 400,
      message: '不能删除自己',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  if (user.role === 'ADMIN') {
    throw createError({
      statusCode: 400,
      message: '不能删除管理员用户',
    })
  }

  // 先清理用户的所有数据，然后删除用户
  await prisma.$transaction(async (tx) => {
    // 删除所有关联数据
    await tx.commentLike.deleteMany({ where: { userId: id } })
    await tx.rating.deleteMany({ where: { userId: id } })
    await tx.favorite.deleteMany({ where: { userId: id } })
    await tx.resource.deleteMany({ where: { uploaderId: id } })
    await tx.downloadRecord.deleteMany({ where: { userId: id } })
    await tx.gameBump.deleteMany({ where: { userId: id } })
    await tx.guide.deleteMany({ where: { userId: id } })
    await tx.report.deleteMany({ where: { reporterId: id } })
    await tx.comment.deleteMany({ where: { userId: id } })
    await tx.gameEditRequest.deleteMany({ where: { userId: id } })
    await tx.activity.deleteMany({ where: { userId: id } })
    await tx.contentEdit.deleteMany({ where: { editorId: id } })
    await tx.userFollow.deleteMany({
      where: {
        OR: [{ followerId: id }, { followingId: id }],
      },
    })
    await tx.message.deleteMany({
      where: {
        OR: [{ senderId: id }, { receiverId: id }],
      },
    })
    await tx.notificationPreference.deleteMany({ where: { userId: id } })

    // 删除用户
    await tx.user.delete({
      where: { id },
    })
  })

  await invalidateUserTokens(id)

  await logAdminOperation({
    adminId: admin.id,
    action: 'DELETE_USER',
    targetType: 'User',
    targetId: id,
    content: `删除用户: ${user.username}(#${id})`,
  })

  return { success: true, message: '用户已删除' }
})

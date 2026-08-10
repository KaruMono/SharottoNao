import { z } from 'zod'
import { requireAdmin, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

const schema = z.object({
  deleteMessages: z.boolean().optional().default(true),
})

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
      message: '不能清理自己的数据',
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const { deleteMessages } = schema.parse(body ?? {})

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
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
      message: '不能清理管理员用户的数据',
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    const commentLikes = await tx.commentLike.deleteMany({ where: { userId: id } })
    const ratings = await tx.rating.deleteMany({ where: { userId: id } })
    const favorites = await tx.favorite.deleteMany({ where: { userId: id } })

    const resources = await tx.resource.deleteMany({ where: { uploaderId: id } })
    const downloads = await tx.downloadRecord.deleteMany({ where: { userId: id } })

    const bumps = await tx.gameBump.deleteMany({ where: { userId: id } })
    const guides = await tx.guide.deleteMany({ where: { userId: id } })

    const reports = await tx.report.deleteMany({ where: { reporterId: id } })

    const comments = await tx.comment.deleteMany({ where: { userId: id } })

    const editRequests = await tx.gameEditRequest.deleteMany({ where: { userId: id } })
    const activities = await tx.activity.deleteMany({ where: { userId: id } })
    const contentEdits = await tx.contentEdit.deleteMany({ where: { editorId: id } })

    const follows = await tx.userFollow.deleteMany({
      where: {
        OR: [{ followerId: id }, { followingId: id }],
      },
    })

    const messages = deleteMessages
      ? await tx.message.deleteMany({
          where: {
            OR: [{ senderId: id }, { receiverId: id }],
          },
        })
      : { count: 0 }

    await tx.user.update({
      where: { id },
      data: {
        tokenVersion: { increment: 1 },
      },
    })

    return {
      commentLikes: commentLikes.count,
      ratings: ratings.count,
      favorites: favorites.count,
      resources: resources.count,
      downloads: downloads.count,
      bumps: bumps.count,
      guides: guides.count,
      reports: reports.count,
      comments: comments.count,
      editRequests: editRequests.count,
      activities: activities.count,
      contentEdits: contentEdits.count,
      follows: follows.count,
      messages: messages.count,
    }
  })

  await invalidateUserTokens(id)

  const countText = Object.entries(result)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ')

  await logAdminOperation({
    adminId: admin.id,
    action: 'CLEANUP_USER',
    targetType: 'User',
    targetId: id,
    content: `清理用户数据; ${countText}`,
  })

  return {
    success: true,
    message: '清理完成',
    result,
  }
})

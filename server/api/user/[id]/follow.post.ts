import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sendNotification, shouldSendMilestoneNotification } from '~/server/utils/notification'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const targetId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(targetId)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  // 不能关注自己
  if (targetId === user.id) {
    throw createError({
      statusCode: 400,
      message: '不能关注自己',
    })
  }

  // 检查目标用户是否存在
  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
  })

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  // 检查是否已关注
  const existingFollow = await prisma.userFollow.findUnique({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: targetId,
      },
    },
  })

  if (existingFollow) {
    // 取消关注
    await prisma.userFollow.delete({
      where: { id: existingFollow.id },
    })
    return { followed: false, message: '已取消关注' }
  } else {
    // 关注
    await prisma.userFollow.create({
      data: {
        followerId: user.id,
        followingId: targetId,
      },
    })

    // 获取被关注者的粉丝总数
    const followerCount = await prisma.userFollow.count({
      where: { followingId: targetId },
    })

    // 只在里程碑数量时发送通知
    if (shouldSendMilestoneNotification(followerCount)) {
      await sendNotification({
        senderId: user.id,
        receiverId: targetId,
        type: 'SYSTEM',
        title: '粉丝里程碑',
        content: `恭喜！你获得了第 ${followerCount} 位粉丝`,
        relatedUrl: `/user/${targetId}`,
      })
    }

    return { followed: true, message: '关注成功' }
  }
})

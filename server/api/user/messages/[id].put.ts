import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的消息ID',
    })
  }

  // 确保消息属于当前用户
  const message = await prisma.message.findFirst({
    where: {
      id,
      receiverId: user.id,
    },
  })

  if (!message) {
    throw createError({
      statusCode: 404,
      message: '消息不存在',
    })
  }

  await prisma.message.update({
    where: { id },
    data: { isRead: true },
  })

  return { success: true }
})

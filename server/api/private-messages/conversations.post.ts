import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { assertCanSendPrivateMessage, getOrCreatePrivateConversation } from '~/server/utils/private-message'

const schema = z.object({
  targetUserId: z.coerce.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { targetUserId } = schema.parse(body)

  if (targetUserId === user.id) {
    throw createError({
      statusCode: 400,
      message: '不能给自己发送私信',
    })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      username: true,
      avatar: true,
      role: true,
      status: true,
    },
  })

  if (!targetUser || targetUser.status !== 'ACTIVE') {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  await assertCanSendPrivateMessage(user, targetUser)
  const conversation = await getOrCreatePrivateConversation(user.id, targetUser.id)

  return {
    id: conversation.id,
    participant: {
      id: targetUser.id,
      username: targetUser.username,
      avatar: targetUser.avatar,
      role: targetUser.role,
    },
  }
})

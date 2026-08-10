import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { isConversationParticipant } from '~/server/utils/private-message'
import { resolveAvatar } from '~/server/utils/gravatar'

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const { limit } = querySchema.parse(getQuery(event))

  if (!Number.isInteger(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会话ID',
    })
  }

  const conversation = await prisma.privateConversation.findUnique({
    where: { id },
    include: {
      participantA: {
        select: { id: true, username: true, email: true, avatar: true, role: true },
      },
      participantB: {
        select: { id: true, username: true, email: true, avatar: true, role: true },
      },
    },
  })

  if (!conversation || !isConversationParticipant(conversation, user.id)) {
    throw createError({
      statusCode: 404,
      message: '会话不存在',
    })
  }

  const now = new Date()
  await prisma.privateMessage.updateMany({
    where: {
      conversationId: id,
      receiverId: user.id,
      readAt: null,
    },
    data: { readAt: now },
  })

  const messages = await prisma.privateMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const otherUser = conversation.participantAId === user.id
    ? conversation.participantB
    : conversation.participantA

  return {
    conversation: {
      id: conversation.id,
      participant: {
        id: otherUser.id,
        username: otherUser.username,
        avatar: await resolveAvatar(otherUser.avatar, otherUser.email),
        role: otherUser.role,
      },
      updatedAt: conversation.updatedAt,
    },
    messages: messages.reverse().map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      type: message.type,
      content: message.content,
      imageUrl: message.imageUrl,
      readAt: message.readAt,
      createdAt: message.createdAt,
    })),
  }
})

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import {
  assertCanSendPrivateMessage,
  getOtherParticipantId,
  isConversationParticipant,
} from '~/server/utils/private-message'
import { markImageAsUsed } from '~/server/utils/image'

const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT'),
    content: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal('IMAGE'),
    imageUrl: z.string().trim().min(1).max(500),
  }),
])

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会话ID',
    })
  }

  const body = schema.parse(await readBody(event))
  const conversation = await prisma.privateConversation.findUnique({
    where: { id },
    include: {
      participantA: {
        select: { id: true, role: true, status: true },
      },
      participantB: {
        select: { id: true, role: true, status: true },
      },
    },
  })

  if (!conversation || !isConversationParticipant(conversation, user.id)) {
    throw createError({
      statusCode: 404,
      message: '会话不存在',
    })
  }

  const receiverId = getOtherParticipantId(conversation, user.id)
  const receiver = conversation.participantAId === receiverId
    ? conversation.participantA
    : conversation.participantB

  if (receiver.status !== 'ACTIVE') {
    throw createError({
      statusCode: 400,
      message: '对方账号不可用',
    })
  }

  await assertCanSendPrivateMessage(user, receiver)

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.privateMessage.create({
      data: {
        conversationId: id,
        senderId: user.id,
        receiverId,
        type: body.type,
        content: body.type === 'TEXT' ? body.content : null,
        imageUrl: body.type === 'IMAGE' ? body.imageUrl : null,
      },
    })

    await tx.privateConversation.update({
      where: { id },
      data: { updatedAt: created.createdAt },
    })

    return created
  })

  if (body.type === 'IMAGE') {
    await markImageAsUsed(body.imageUrl)
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    type: message.type,
    content: message.content,
    imageUrl: message.imageUrl,
    readAt: message.readAt,
    createdAt: message.createdAt,
  }
})

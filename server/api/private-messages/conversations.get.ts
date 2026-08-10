import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { getOtherParticipantId } from '~/server/utils/private-message'
import { resolveAvatar } from '~/server/utils/gravatar'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const conversations = await prisma.privateConversation.findMany({
    where: {
      OR: [
        { participantAId: user.id },
        { participantBId: user.id },
      ],
    },
    include: {
      participantA: {
        select: { id: true, username: true, email: true, avatar: true, role: true },
      },
      participantB: {
        select: { id: true, username: true, email: true, avatar: true, role: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const unreadCounts = await Promise.all(
    conversations.map(conversation => prisma.privateMessage.count({
      where: {
        conversationId: conversation.id,
        receiverId: user.id,
        readAt: null,
      },
    })),
  )

  const items = await Promise.all(conversations.map(async (conversation, index) => {
    const otherUser = conversation.participantAId === user.id
      ? conversation.participantB
      : conversation.participantA
    const lastMessage = conversation.messages[0]

    return {
      id: conversation.id,
      participant: {
        id: otherUser.id,
        username: otherUser.username,
        avatar: await resolveAvatar(otherUser.avatar, otherUser.email),
        role: otherUser.role,
      },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        senderId: lastMessage.senderId,
        receiverId: lastMessage.receiverId,
        type: lastMessage.type,
        content: lastMessage.content,
        imageUrl: lastMessage.imageUrl,
        readAt: lastMessage.readAt,
        createdAt: lastMessage.createdAt,
      } : null,
      unreadCount: unreadCounts[index],
      updatedAt: conversation.updatedAt,
      otherParticipantId: getOtherParticipantId(conversation, user.id),
    }
  }))

  return { items }
})

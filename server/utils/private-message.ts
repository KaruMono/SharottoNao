import type { User, UserRole } from '@prisma/client'
import prisma from './prisma'
import { getSetting } from './settings'

export const PRIVATE_MESSAGE_ALLOWED_ROLES_KEY = 'private_message_allowed_roles'
export const DEFAULT_PRIVATE_MESSAGE_ALLOWED_ROLES: UserRole[] = ['ADMIN', 'EDITOR']

export function normalizeConversationParticipants(userId: number, targetUserId: number) {
  return {
    participantAId: Math.min(userId, targetUserId),
    participantBId: Math.max(userId, targetUserId),
  }
}

export async function getPrivateMessageAllowedRoles(): Promise<UserRole[]> {
  const raw = await getSetting(PRIVATE_MESSAGE_ALLOWED_ROLES_KEY)
  if (raw === null) return DEFAULT_PRIVATE_MESSAGE_ALLOWED_ROLES

  const roles = raw
    .split(',')
    .map(role => role.trim())
    .filter((role): role is UserRole => role === 'ADMIN' || role === 'EDITOR' || role === 'USER')

  return Array.from(new Set(roles))
}

export async function canSendPrivateMessage(sender: Pick<User, 'id' | 'role'>, receiver: Pick<User, 'id' | 'role'>) {
  if (sender.id === receiver.id) return false

  const allowedRoles = await getPrivateMessageAllowedRoles()
  return allowedRoles.includes(receiver.role) || allowedRoles.includes(sender.role)
}

export async function assertCanSendPrivateMessage(sender: Pick<User, 'id' | 'role'>, receiver: Pick<User, 'id' | 'role'>) {
  const allowed = await canSendPrivateMessage(sender, receiver)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: '当前用户只能给管理员或编辑发送站内信',
    })
  }
}

export async function getOrCreatePrivateConversation(userId: number, targetUserId: number) {
  const participants = normalizeConversationParticipants(userId, targetUserId)

  return prisma.privateConversation.upsert({
    where: {
      participantAId_participantBId: participants,
    },
    update: {},
    create: participants,
  })
}

export function isConversationParticipant(
  conversation: { participantAId: number; participantBId: number },
  userId: number,
) {
  return conversation.participantAId === userId || conversation.participantBId === userId
}

export function getOtherParticipantId(
  conversation: { participantAId: number; participantBId: number },
  userId: number,
) {
  return conversation.participantAId === userId ? conversation.participantBId : conversation.participantAId
}

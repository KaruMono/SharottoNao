import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const ALL_TYPES = [
  'COMMENT_REPLY',
  'COMMENT_LIKE',
  'MENTION',
  'RESOURCE_APPROVED',
  'RESOURCE_REJECTED',
  'RESOURCE_HEALTH',
  'EDIT_APPROVED',
  'EDIT_REJECTED',
  'FOLLOWING_ACTIVITY',
  'FAVORITE_GAME_UPDATE',
  'SYSTEM',
] as const

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: user.id },
  })

  const prefMap = new Map(prefs.map((p) => [p.messageType, p.emailEnabled]))

  // 无记录的类型默认返回 emailEnabled: true
  const preferences = Object.fromEntries(
    ALL_TYPES.map((type) => [type, prefMap.get(type) ?? true]),
  )

  return { preferences }
})

import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { canSendPrivateMessage, getPrivateMessageAllowedRoles } from '~/server/utils/private-message'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const targetUserId = query.targetUserId ? Number(query.targetUserId) : null
  const allowedRoles = await getPrivateMessageAllowedRoles()

  let canSendToTarget = false
  if (targetUserId && Number.isInteger(targetUserId)) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    })

    canSendToTarget = !!targetUser
      && targetUser.status === 'ACTIVE'
      && await canSendPrivateMessage(user, targetUser)
  }

  return {
    allowedRoles,
    canSendToTarget,
  }
})

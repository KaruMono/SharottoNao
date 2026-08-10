import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const unreadCount = await prisma.privateMessage.count({
    where: {
      receiverId: user.id,
      readAt: null,
    },
  })

  return { unreadCount }
})

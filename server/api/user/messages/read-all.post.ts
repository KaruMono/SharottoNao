import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  await prisma.message.updateMany({
    where: {
      receiverId: user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  })

  return { success: true }
})

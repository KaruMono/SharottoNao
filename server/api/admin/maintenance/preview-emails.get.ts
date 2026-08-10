import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true },
  })

  const affected = users.filter(u => u.email !== u.email.toLowerCase())

  return { users: affected }
})

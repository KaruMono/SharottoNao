import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const links = await prisma.friendLink.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return links
})

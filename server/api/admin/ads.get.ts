import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const ads = await prisma.advertisement.findMany({
    orderBy: [{ slot: 'asc' }, { sortOrder: 'asc' }],
  })

  return ads
})

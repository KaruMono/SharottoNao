import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const categories = await prisma.toolCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { tools: true } },
    },
  })

  return categories
})

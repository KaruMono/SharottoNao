import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const types = await prisma.resourceType.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { resources: true },
      },
    },
  })

  return types.map(t => ({
    ...t,
    resourcesCount: t._count.resources,
  }))
})

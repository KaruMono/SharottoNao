import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const types = await prisma.netDiskType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      _count: {
        select: { resources: true },
      },
    },
  })

  return types.map(type => ({
    ...type,
    resourcesCount: type._count.resources,
  }))
})
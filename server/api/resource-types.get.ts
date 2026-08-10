import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const types = await prisma.resourceType.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return types
})

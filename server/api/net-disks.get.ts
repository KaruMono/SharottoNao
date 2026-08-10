import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  return prisma.netDiskType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
})
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = query.q as string | undefined
  const limit = parseInt(query.limit as string) || 10

  if (!q || q.length < 1) {
    return []
  }

  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      username: { contains: q, mode: 'insensitive' },
    },
    select: {
      id: true,
      username: true,
      avatar: true,
    },
    take: limit,
  })

  return users
})

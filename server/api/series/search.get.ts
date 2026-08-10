import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = query.q as string | undefined
  const limit = parseInt(query.limit as string) || 10

  if (!q || q.length < 1) {
    return []
  }

  const series = await prisma.gameSeries.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { nameOriginal: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      nameOriginal: true,
      coverImage: true,
      _count: { select: { games: true } },
    },
    take: limit,
  })

  return series.map(s => ({
    id: s.id,
    name: s.name,
    nameOriginal: s.nameOriginal,
    coverImage: s.coverImage,
    gamesCount: s._count.games,
  }))
})

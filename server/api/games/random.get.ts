import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { buildNsfwFilterFromUser } from '~/server/utils/nsfw'

const MAX_RANDOM_RETRIES = 8

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  const nsfwFilter = buildNsfwFilterFromUser(user)
  const where = { deletedAt: null, ...nsfwFilter }

  const bounds = await prisma.game.aggregate({
    where,
    _min: { id: true },
    _max: { id: true },
    _count: { id: true },
  })

  if (bounds._count.id === 0 || bounds._min.id === null || bounds._max.id === null) {
    throw createError({ statusCode: 404, message: '暂无游戏' })
  }

  for (let i = 0; i < MAX_RANDOM_RETRIES; i++) {
    const candidateId = randomInt(bounds._min.id, bounds._max.id)
    const game = await prisma.game.findFirst({
      where: { ...where, id: { gte: candidateId } },
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    if (game) return { id: game.id }
  }

  const fallback = await prisma.game.findFirst({
    where,
    select: { id: true },
    orderBy: { id: Math.random() < 0.5 ? 'asc' : 'desc' },
  })

  return { id: fallback!.id }
})

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

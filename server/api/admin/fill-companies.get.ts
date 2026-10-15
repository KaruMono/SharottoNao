import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [totalWithVndbId, games] = await Promise.all([
    prisma.game.count({
      where: { vndbId: { not: null }, deletedAt: null },
    }),
    prisma.game.findMany({
      where: {
        vndbId: { not: null },
        deletedAt: null,
        companies: { none: {} },
      },
      select: {
        id: true,
        vndbId: true,
        titleZhHans: true,
        titleJa: true,
        titleEn: true,
      },
      orderBy: { id: 'asc' },
    }),
  ])

  return {
    totalWithVndbId,
    missingCompanyCount: games.length,
    games,
  }
})

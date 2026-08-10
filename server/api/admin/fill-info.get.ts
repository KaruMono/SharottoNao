import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const games = await prisma.game.findMany({
    where: { vndbId: { not: null }, deletedAt: null },
    select: {
      id: true,
      vndbId: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      _count: { select: { staff: true, companies: true } },
    },
    orderBy: { id: 'asc' },
  })

  return {
    games: games.map(g => ({
      id: g.id,
      vndbId: g.vndbId,
      titleZhHans: g.titleZhHans,
      titleJa: g.titleJa,
      titleEn: g.titleEn,
      hasStaff: g._count.staff > 0,
      hasCompany: g._count.companies > 0,
    })),
    total: games.length,
  }
})

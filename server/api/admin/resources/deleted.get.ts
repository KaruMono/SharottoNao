import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const resources = await prisma.resource.findMany({
    where: {
      deletedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      url: true,
      deletedAt: true,
      game: {
        select: {
          id: true,
          titleZhHans: true,
          titleJa: true,
          titleEn: true,
        },
      },
    },
    orderBy: { deletedAt: 'desc' },
  })

  return {
    total: resources.length,
    resources: resources.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      deletedAt: r.deletedAt,
      gameId: r.game.id,
      gameTitle: r.game.titleZhHans || r.game.titleJa || r.game.titleEn || `#${r.game.id}`,
    })),
  }
})

/**
 * Sitemap 动态 URL 生成器 - 游戏
 */
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {

  try {
    const games = await prisma.game.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return games.map((game) => ({
      loc: `/games/${game.id}`,
      lastmod: game.updatedAt,
      changefreq: 'weekly',
      priority: 0.8,
    }))
  } catch (error) {
    console.error('Sitemap games error:', error)
    return []
  }
})

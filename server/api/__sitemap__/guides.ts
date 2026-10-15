/**
 * Sitemap 动态 URL 生成器 - 攻略
 */
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {

  try {
    const guides = await prisma.guide.findMany({
      where: {
        deletedAt: null,
      } as any,
      select: {
        id: true,
        gameId: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return guides.map((guide) => ({
      loc: `/games/${guide.gameId}/guides#guide-${guide.id}`,
      lastmod: guide.updatedAt,
      changefreq: 'monthly',
      priority: 0.7,
    }))
  } catch (error) {
    console.error('Sitemap guides error:', error)
    return []
  }
})

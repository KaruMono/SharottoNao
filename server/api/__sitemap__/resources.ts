/**
 * Sitemap 动态 URL 生成器 - 资源
 */
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {

  try {
    const resources = await prisma.resource.findMany({
      where: {
        deletedAt: null,
        status: 'APPROVED',
      } as any,
      select: {
        id: true,
        gameId: true,
        updatedAt: true,
      } as any,
      orderBy: {
        updatedAt: 'desc',
      } as any,
      take: 1000, // 限制数量
    })

    return resources.map((resource: any) => ({
      loc: `/games/${resource.gameId}#resource-${resource.id}`,
      lastmod: resource.updatedAt,
      changefreq: 'monthly',
      priority: 0.6,
    }))
  } catch (error) {
    console.error('Sitemap resources error:', error)
    return []
  }
})

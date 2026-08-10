import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  try {
    // 从配置表获取热门搜索
    const config = await prisma.siteConfig.findUnique({
      where: { key: 'hot_searches' },
    })
    
    if (config?.value) {
      const items = JSON.parse(config.value)
      return { items: Array.isArray(items) ? items : [] }
    }
  } catch {
    // 忽略错误
  }
  
  // 默认热门搜索（可以从浏览量最高的游戏获取）
  const topGames = await prisma.game.findMany({
    select: {
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
    },
    orderBy: { viewCount: 'desc' },
    take: 8,
  })
  
  const items = topGames.map(g => g.titleZhHans || g.titleJa || g.titleEn || '').filter(Boolean)
  return { items }
})

import prisma from '~/server/utils/prisma'
import { getRequestIP } from 'h3'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的攻略ID' })
  }

  // 简单的 IP 防刷：利用内存缓存限制同一 IP 对同一攻略的浏览计数频率
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const cacheKey = `guide-view:${id}:${ip}`
  const storage = useStorage('cache')
  
  const cached = await storage.getItem(cacheKey)
  if (cached) {
    // 已在冷却期内，不重复计数
    return { success: true }
  }

  const guide = await prisma.guide.findUnique({
    where: { id },
    select: { id: true, game: { select: { deletedAt: true } } },
  })

  if (!guide || guide.game.deletedAt) {
    throw createError({ statusCode: 404, message: '攻略不存在' })
  }

  // 设置 5 分钟冷却
  await storage.setItem(cacheKey, true, { ttl: 300 })

  await prisma.guide.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  })

  return { success: true }
})

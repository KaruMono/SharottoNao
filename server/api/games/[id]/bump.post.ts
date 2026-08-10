import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { invalidateCache } from '~/server/utils/redis'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的游戏ID' })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '游戏不存在' })
  }

  // 今天的日期（只保留日期部分）
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  // 直接创建顶一下记录，依赖 bumpDate 唯一约束判断今天是否已经顶过（避免先查后写的并发问题）
  try {
    await prisma.gameBump.create({
      data: {
        gameId,
        userId: user.id,
        bumpDate: todayDate,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 400, message: '今天已经顶过了，明天再来吧' })
    }
    throw e
  }

  // 获取今日顶数
  const todayBumps = await prisma.gameBump.count({
    where: {
      gameId,
      bumpDate: todayDate,
    },
  })

  // 获取总顶数
  const totalBumps = await prisma.gameBump.count({
    where: { gameId },
  })

  // 清除游戏列表缓存，让顶置排序立即反映新顶数
  await invalidateCache('games:*')

  return {
    success: true,
    todayBumps,
    totalBumps,
  }
})

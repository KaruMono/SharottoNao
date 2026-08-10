import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { recordActivity } from '~/server/utils/activity'

const schema = z.object({
  score: z.number().min(1).max(5),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const { score } = schema.parse(body)
  
  if (isNaN(gameId)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  // 创建或更新评分
  const isNew = !(await prisma.rating.findUnique({
    where: { gameId_userId: { gameId, userId: user.id } },
    select: { id: true },
  }))

  await prisma.rating.upsert({
    where: {
      gameId_userId: { gameId, userId: user.id },
    },
    create: {
      gameId,
      userId: user.id,
      score,
    },
    update: {
      score,
    },
  })

  // 仅首次评分才记录活动
  if (isNew) {
    recordActivity({
      userId: user.id,
      type: 'RATE_GAME',
      targetType: 'game',
      targetId: gameId,
      meta: {
        gameTitle: game.titleZhHans || game.titleJa || game.titleEn,
        score,
      },
    })
  }

  // 获取新的平均分
  const avgRating = await prisma.rating.aggregate({
    where: { gameId },
    _avg: { score: true },
    _count: true,
  })

  return {
    success: true,
    userRating: score,
    avgRating: avgRating._avg.score ? Number(avgRating._avg.score.toFixed(1)) : null,
    ratingCount: avgRating._count,
  }
})

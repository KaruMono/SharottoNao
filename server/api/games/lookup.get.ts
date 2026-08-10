import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vndbId = query.vndbId as string | undefined
  const bangumiId = query.bangumiId ? Number(query.bangumiId) : undefined

  if (!vndbId && !bangumiId) {
    throw createError({ statusCode: 400, message: '请提供 vndbId 或 bangumiId' })
  }

  const game = await prisma.game.findFirst({
    where: {
      deletedAt: null,
      ...(vndbId ? { vndbId } : { bangumiId }),
    },
    select: { id: true },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '未找到对应游戏' })
  }

  return { id: game.id }
})

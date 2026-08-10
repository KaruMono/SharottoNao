import type { HikariResponse } from '~/types/hikari'

export default defineEventHandler(async (event) => {
  const gameId = getRouterParam(event, 'id')
  
  if (!gameId) {
    throw createError({
      statusCode: 400,
      message: '缺少游戏 ID',
    })
  }

  // 获取游戏的 VNDB ID
  const game = await prisma.game.findUnique({
    where: { id: Number(gameId) },
    select: { vndbId: true },
  })

  if (!game?.vndbId) {
    return {
      success: false,
      message: '该游戏没有 VNDB ID',
      data: null,
    }
  }

  try {
    // 调用 Hikari API
    const response = await $fetch<HikariResponse>(
      `https://www.moyu.moe/api/hikari?vndb_id=${game.vndbId}`,
      {
        timeout: 10000, // 10秒超时
      }
    )

    return response
  } catch (error: any) {
    // 如果是 404，说明没有补丁，静默处理
    if (error.statusCode === 404 || error.status === 404) {
      return {
        success: false,
        message: '暂无补丁资源',
        data: null,
      }
    }

    console.warn(`获取 Hikari 补丁失败 (vndb: ${game.vndbId}):`, error.message || error.statusMessage || 'Unknown error')

    return {
      success: false,
      message: '获取补丁资源失败',
      data: null,
    }
  }
})

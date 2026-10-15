import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import prisma from '../../../utils/prisma'
import { getAuthUser } from '../../../utils/auth'
import { getMoyuClient, MoyuApiError } from '../../../utils/moyu-client'
import type { MoyuPatchesResponse } from '../../../../types/moyu'

export default defineEventHandler(async (event): Promise<MoyuPatchesResponse> => {
  // Access depends on the current user's content preference. Cache upstream data
  // inside the client, never share this authenticated response through a CDN.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const rawId = getRouterParam(event, 'id') || ''
  const gameId = Number(rawId)
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(gameId)) {
    throw createError({ statusCode: 400, message: '无效的游戏 ID' })
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
    select: { vndbId: true, isNsfw: true },
  })
  if (!game) throw createError({ statusCode: 404, message: '条目不存在' })

  const user = await getAuthUser(event)
  const allowNsfw = !!user && user.nsfwMode !== 'SFW'
  if (game.isNsfw && !allowNsfw) {
    throw createError({ statusCode: 403, message: user ? '当前NSFW模式不允许查看此内容' : '请登录后查看此内容' })
  }
  if (!game.vndbId) return { status: 'missing_vndb', patches: [] }

  try {
    const config = useRuntimeConfig(event)
    const result = await getMoyuClient(config.nextmoeApiKey).findPatches(game.vndbId, allowNsfw)
    return { status: 'ok', patches: result.items }
  } catch (error) {
    if (!(error instanceof MoyuApiError)) throw error
    if (error.retryAfter) setResponseHeader(event, 'Retry-After', error.retryAfter)
    throw createError({
      statusCode: error.statusCode,
      message: error.message,
      data: { code: error.code, retryAfter: error.retryAfter },
    })
  }
})

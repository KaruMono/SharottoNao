import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import { syncVndbTagsForGame } from '~/server/utils/vndb-tag-sync'
import { invalidateGameCaches } from '~/server/utils/redis'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

const schema = z.object({
  markGameNsfw: z.boolean().optional().default(false),
}).default({})

export default defineEventHandler(async (event) => {
  const editor = await requireEditor(event)
  const gameId = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, message: '无效的游戏 ID' })
  }
  const body = schema.parse((await readBody(event)) || {})

  const game = await prisma.game.findFirst({
    where: { id: gameId, deletedAt: null },
    select: { id: true, vndbId: true },
  })
  if (!game) throw createError({ statusCode: 404, message: '游戏不存在' })
  if (!game.vndbId) throw createError({ statusCode: 400, message: '该游戏没有 VNDB ID' })

  const upstream = await fetchVndbGame(game.vndbId)
  const result = await syncVndbTagsForGame({
    gameId,
    tags: upstream.tags,
    expectedVndbId: game.vndbId,
  })

  if (body.markGameNsfw && result.suggestsGameNsfw) {
    await prisma.game.update({ where: { id: gameId }, data: { isNsfw: true } })
  }

  await invalidateGameCaches(gameId)
  logAdminOperation({
    adminId: editor.id,
    action: 'SYNC_GAME_VNDB_TAGS',
    targetType: 'Game',
    targetId: gameId,
    content: `从 ${game.vndbId} 同步 ${result.rawTagCount} 个原始标签，应用 ${result.appliedTagIds.length} 个中文标签`,
  }).catch(() => {})

  return {
    ...result,
    gameMarkedNsfw: Boolean(body.markGameNsfw && result.suggestsGameNsfw),
  }
})

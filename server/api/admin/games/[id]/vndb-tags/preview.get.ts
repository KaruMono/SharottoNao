import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import {
  DEFAULT_VNDB_TAG_SYNC_POLICY,
  isAdultVndbTag,
  normalizeVndbTags,
} from '~/server/utils/vndb-tag-sync'

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const gameId = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw createError({ statusCode: 400, message: '无效的游戏 ID' })
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, deletedAt: null },
    select: { id: true, vndbId: true, vndbTagsSyncedAt: true },
  })
  if (!game) throw createError({ statusCode: 404, message: '游戏不存在' })
  if (!game.vndbId) throw createError({ statusCode: 400, message: '该游戏没有 VNDB ID' })

  const upstream = await fetchVndbGame(game.vndbId)
  const tags = normalizeVndbTags(upstream.tags)
  const known = await prisma.vndbTag.findMany({
    where: { id: { in: tags.map(tag => tag.id) } },
    select: {
      id: true,
      status: true,
      displayTier: true,
      isNsfw: true,
      affectsGameNsfw: true,
      tag: { select: { id: true, name: true, isNsfw: true, archivedAt: true } },
    },
  })
  const knownById = new Map(known.map(tag => [tag.id, tag]))

  const items = tags
    .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id, 'en'))
    .map((tag) => {
      const stored = knownById.get(tag.id)
      const status = stored?.status || 'PENDING'
      const isNsfw = stored?.isNsfw ?? isAdultVndbTag(tag)
      const eligible = status === 'MAPPED'
        && Boolean(stored?.tag)
        && tag.rating >= DEFAULT_VNDB_TAG_SYNC_POLICY.minRating
        && tag.spoiler <= DEFAULT_VNDB_TAG_SYNC_POLICY.maxSpoiler

      return {
        ...tag,
        status,
        displayTier: stored?.displayTier || 'PRIMARY',
        isNsfw,
        affectsGameNsfw: stored?.affectsGameNsfw ?? isAdultVndbTag(tag),
        tag: stored?.tag || null,
        eligible,
      }
    })

  return {
    gameId: game.id,
    vndbId: game.vndbId,
    lastSyncedAt: game.vndbTagsSyncedAt,
    policy: DEFAULT_VNDB_TAG_SYNC_POLICY,
    items,
    summary: {
      total: items.length,
      mapped: items.filter(tag => tag.status === 'MAPPED').length,
      pending: items.filter(tag => tag.status === 'PENDING').length,
      ignored: items.filter(tag => tag.status === 'IGNORED').length,
      eligible: items.filter(tag => tag.eligible).length,
    },
  }
})

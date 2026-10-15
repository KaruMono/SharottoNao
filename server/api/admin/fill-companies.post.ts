import { z } from 'zod'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import { syncVndbDevelopersForGame } from '~/server/utils/vndb-company-sync'

const schema = z.object({
  gameId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'gameId 必须是有效的游戏 ID' })
  }
  const body = parsed.data

  const game = await prisma.game.findFirst({
    where: { id: body.gameId, deletedAt: null },
    select: {
      id: true,
      vndbId: true,
      titleZhHans: true,
      titleJa: true,
      titleEn: true,
      _count: { select: { companies: true } },
    },
  })

  if (!game?.vndbId) {
    throw createError({ statusCode: 404, message: '游戏不存在或没有 VNDB ID' })
  }

  const label = game.titleZhHans || game.titleJa || game.titleEn || `#${game.id}`
  if (game._count.companies > 0) {
    return {
      gameId: game.id,
      label,
      skipped: true,
      reason: '游戏已有会社关联，已跳过',
      developersFound: 0,
      companiesMatched: 0,
      companiesCreated: 0,
      companiesLinked: 0,
      matchedNames: [],
      createdNames: [],
    }
  }

  const vndbData = await fetchVndbGame(game.vndbId)
  const result = await prisma.$transaction(async (tx) => {
    const existingRelation = await tx.gameCompany.count({ where: { gameId: game.id } })
    if (existingRelation > 0) return null

    return syncVndbDevelopersForGame(tx, {
      gameId: game.id,
      creatorId: admin.id,
      developers: vndbData.developers || [],
    })
  })

  if (!result) {
    return {
      gameId: game.id,
      label,
      skipped: true,
      reason: '处理期间游戏已补充会社，已跳过',
      developersFound: 0,
      companiesMatched: 0,
      companiesCreated: 0,
      companiesLinked: 0,
      matchedNames: [],
      createdNames: [],
    }
  }

  if (result.companiesLinked > 0) {
    await logAdminOperation({
      adminId: admin.id,
      action: 'FILL_VNDB_COMPANIES',
      targetType: 'Game',
      targetId: game.id,
      content: `通过 VNDB 为「${label}」补全会社 ${result.companiesLinked} 个，自动创建 ${result.companiesCreated} 个`,
    })
  }

  return {
    gameId: game.id,
    label,
    skipped: false,
    ...result,
  }
})

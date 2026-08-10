import { z } from 'zod'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的游戏ID' })
  }

  const game = await prisma.game.findUnique({ where: { id }, select: { id: true } })
  if (!game) {
    throw createError({ statusCode: 404, message: '游戏不存在' })
  }

  const { page, limit } = querySchema.parse(getQuery(event))
  const skip = (page - 1) * limit

  const [rawItems, total] = await Promise.all([
    prisma.contentEdit.findMany({
      where: { targetType: 'GAME', targetId: id },
      include: {
        editor: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contentEdit.count({ where: { targetType: 'GAME', targetId: id } }),
  ])

  // Collect series IDs from changes to resolve names
  const seriesIds = new Set<number>()
  for (const item of rawItems) {
    const snapshot = item.snapshot as Record<string, unknown> | null
    const changes = (snapshot?._changes || []) as Array<{ field: string; old?: unknown; new?: unknown }>
    for (const c of changes) {
      if (c.field === 'seriesId') {
        if (typeof c.old === 'number') seriesIds.add(c.old)
        if (typeof c.new === 'number') seriesIds.add(c.new)
      }
    }
  }

  const seriesMap = new Map<number, string>()
  if (seriesIds.size > 0) {
    const seriesList = await prisma.gameSeries.findMany({
      where: { id: { in: [...seriesIds] } },
      select: { id: true, name: true },
    })
    for (const s of seriesList) seriesMap.set(s.id, s.name)
  }

  const items = rawItems.map((item) => {
    const snapshot = item.snapshot as Record<string, unknown> | null
    const changes = ((snapshot?._changes || []) as Array<{ field: string; label: string; old?: unknown; new?: unknown }>).map((c) => {
      if (c.field === 'seriesId') {
        return {
          ...c,
          oldDisplay: typeof c.old === 'number' ? seriesMap.get(c.old) || `#${c.old}` : null,
          newDisplay: typeof c.new === 'number' ? seriesMap.get(c.new) || `#${c.new}` : null,
        }
      }
      return c
    })
    return {
      id: item.id,
      targetType: item.targetType,
      targetId: item.targetId,
      editorId: item.editorId,
      editor: item.editor,
      changeSummary: item.changeSummary,
      isRevert: item.isRevert,
      createdAt: item.createdAt,
      snapshot: { _changes: changes },
    }
  })

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

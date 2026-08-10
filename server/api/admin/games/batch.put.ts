import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { recordEdit } from '~/server/utils/content-edit'

const schema = z.object({
  ids: z.array(z.number()).min(1),
  action: z.enum(['setCompany', 'addTags', 'removeTags', 'setSeries']),
  companyId: z.number().optional(),
  companyRole: z.enum(['DEVELOPER', 'PUBLISHER']).optional(),
  tagIds: z.array(z.number()).optional(),
  seriesId: z.number().nullable().optional(),
})

const ACTION_LABELS: Record<string, string> = {
  setCompany: '批量添加会社',
  addTags: '批量添加标签',
  removeTags: '批量移除标签',
  setSeries: '批量设置系列',
}

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  const { ids, action, companyId, companyRole, tagIds, seriesId } = schema.parse(body)

  let count = 0

  if (action === 'setCompany') {
    if (!companyId) {
      throw createError({ statusCode: 400, message: '请选择会社' })
    }
    const role = companyRole || 'DEVELOPER'
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } })
    for (const gameId of ids) {
      const existing = await prisma.gameCompany.findFirst({
        where: { gameId, companyId },
      })
      if (!existing) {
        await prisma.gameCompany.create({
          data: { gameId, companyId, role },
        })
        count++
        recordEdit({
          targetType: 'GAME',
          targetId: gameId,
          editorId: user.id,
          snapshot: { _changes: [{ field: 'companies', label: '关联会社', new: { companyId, companyName: company?.name, role } }] },
          changeSummary: `批量添加会社（${company?.name || `#${companyId}`}，${role === 'DEVELOPER' ? '开发商' : '发行商'}）`,
        }).catch(() => {})
      }
    }
    return { success: true, message: `已为 ${count} 个游戏添加会社` }
  }

  if (action === 'addTags') {
    if (!tagIds?.length) {
      throw createError({ statusCode: 400, message: '请选择标签' })
    }
    const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true } })
    const tagNames = tags.map(t => t.name)
    for (const gameId of ids) {
      for (const tagId of tagIds) {
        await prisma.gameTag.upsert({
          where: { gameId_tagId: { gameId, tagId } },
          update: {},
          create: { gameId, tagId },
        })
      }
      count++
      recordEdit({
        targetType: 'GAME',
        targetId: gameId,
        editorId: user.id,
        snapshot: { _changes: [{ field: 'tags', label: '标签', new: { added: tagIds, addedNames: tagNames } }] },
        changeSummary: `批量添加标签（${tagNames.join('，')}）`,
      }).catch(() => {})
    }
    return { success: true, message: `已为 ${count} 个游戏添加标签` }
  }

  if (action === 'removeTags') {
    if (!tagIds?.length) {
      throw createError({ statusCode: 400, message: '请选择标签' })
    }
    const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true } })
    const tagNames = tags.map(t => t.name)
    for (const gameId of ids) {
      recordEdit({
        targetType: 'GAME',
        targetId: gameId,
        editorId: user.id,
        snapshot: { _changes: [{ field: 'tags', label: '标签', new: { removed: tagIds, removedNames: tagNames } }] },
        changeSummary: `批量移除标签（${tagNames.join('，')}）`,
      }).catch(() => {})
    }
    const result = await prisma.gameTag.deleteMany({
      where: {
        gameId: { in: ids },
        tagId: { in: tagIds },
      },
    })
    return { success: true, message: `已移除 ${result.count} 条标签关联` }
  }

  if (action === 'setSeries') {
    let seriesName: string | null = null
    if (seriesId) {
      const series = await prisma.gameSeries.findUnique({ where: { id: seriesId }, select: { name: true } })
      seriesName = series?.name || null
    }
    for (const gameId of ids) {
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { seriesId: true } })
      recordEdit({
        targetType: 'GAME',
        targetId: gameId,
        editorId: user.id,
        snapshot: {
          _changes: [{
            field: 'seriesId',
            label: '游戏系列',
            old: game?.seriesId ?? null,
            new: seriesId ?? null,
          }],
        },
        changeSummary: seriesId
          ? `批量设置系列 → ${seriesName || `#${seriesId}`}`
          : '批量移除系列',
      }).catch(() => {})
    }
    const result = await prisma.game.updateMany({
      where: { id: { in: ids } },
      data: { seriesId: seriesId ?? null },
    })
    return { success: true, message: `已更新 ${result.count} 个游戏的系列` }
  }

  throw createError({ statusCode: 400, message: '未知操作' })
})

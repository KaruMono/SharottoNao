import { TagDisplayTier } from '@prisma/client'
import { z } from 'zod'
import { requireAdmin, requireEditor } from '~/server/utils/auth'
import { lockGameTagStatesInTransaction } from '~/server/utils/game-tag-source'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'
import {
  purgeArchivedTagsInTransaction,
  TagPurgeRejectedError,
} from '~/server/utils/tag-purge'
import {
  lockVndbTagMappingInTransaction,
  reconcileVndbTagSourcesInTransaction,
} from '~/server/utils/vndb-tag-sync'
import { generateRandomTagColor } from '~/utils/random-tag-color'

const tagIdsSchema = z.array(
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
).min(1).max(200).transform(ids => [...new Set(ids)])

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('randomize-colors'),
    ids: tagIdsSchema,
  }).strict(),
  z.object({
    action: z.literal('set-policy'),
    ids: tagIdsSchema,
    isNsfw: z.boolean().optional(),
    displayTier: z.nativeEnum(TagDisplayTier).optional(),
  }).strict(),
  z.object({
    action: z.literal('purge'),
    ids: tagIdsSchema,
  }).strict(),
])

async function invalidateTagCaches() {
  await Promise.all([
    invalidateGameCaches(),
    invalidateCache('game:*'),
    invalidateCache('tags:*'),
  ])
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const data = schema.parse(await readBody(event))

  if (data.action === 'randomize-colors') {
    await prisma.$transaction(async (tx) => {
      const tags = await tx.tag.findMany({
        where: { id: { in: data.ids } },
        select: { id: true, isSystem: true },
      })

      if (tags.length !== data.ids.length) {
        throw createError({ statusCode: 404, message: '部分标签不存在' })
      }
      if (tags.some(tag => tag.isSystem)) {
        throw createError({ statusCode: 400, message: '系统标签不能随机改色' })
      }

      for (const id of data.ids) {
        await tx.tag.update({
          where: { id },
          data: { color: generateRandomTagColor() },
        })
      }
    })

    await invalidateTagCaches()
    return {
      success: true,
      action: data.action,
      updatedCount: data.ids.length,
    }
  }

  if (data.action === 'set-policy') {
    if (data.isNsfw === undefined && data.displayTier === undefined) {
      throw createError({ statusCode: 400, message: '至少需要设置一个标签属性' })
    }

    const result = await prisma.$transaction(async (tx) => {
      if (data.displayTier !== undefined || data.isNsfw === false) {
        await lockVndbTagMappingInTransaction(tx)
      }

      const tags = await tx.tag.findMany({
        where: { id: { in: data.ids } },
        select: { id: true, isSystem: true },
      })
      if (tags.length !== data.ids.length) {
        throw createError({ statusCode: 404, message: '部分标签不存在' })
      }
      if (tags.some(tag => tag.isSystem)) {
        throw createError({ statusCode: 400, message: '系统标签不能批量修改属性' })
      }

      if (data.isNsfw === false) {
        const adultMapping = await tx.vndbTag.findFirst({
          where: {
            tagId: { in: data.ids },
            status: 'MAPPED',
            isNsfw: true,
          },
          select: { id: true, nameEn: true },
        })
        if (adultMapping) {
          throw createError({
            statusCode: 409,
            message: `选中的标签仍映射成人 VNDB 标签 ${adultMapping.id}（${adultMapping.nameEn}），不能设为 SFW`,
          })
        }
      }

      let affectedGameIds: number[] = []
      let updatedMappings = 0
      if (data.displayTier !== undefined) {
        const affectedGames = await tx.gameVndbTag.findMany({
          where: { vndbTag: { tagId: { in: data.ids } } },
          select: { gameId: true },
          distinct: ['gameId'],
          orderBy: { gameId: 'asc' },
        })
        affectedGameIds = affectedGames.map(game => game.gameId)
        await lockGameTagStatesInTransaction(tx, affectedGameIds)

        const mappings = await tx.vndbTag.updateMany({
          where: { tagId: { in: data.ids } },
          data: { displayTier: data.displayTier },
        })
        updatedMappings = mappings.count
        await reconcileVndbTagSourcesInTransaction(tx, {
          gameIds: affectedGameIds,
          alreadyLocked: true,
        })
      }

      if (data.isNsfw !== undefined) {
        await tx.tag.updateMany({
          where: { id: { in: data.ids } },
          data: { isNsfw: data.isNsfw },
        })
      }

      return { updatedMappings, affectedGames: affectedGameIds.length }
    }, { maxWait: 10_000, timeout: 60_000 })

    await invalidateTagCaches()
    return {
      success: true,
      action: data.action,
      updatedCount: data.ids.length,
      ...result,
    }
  }

  const admin = await requireAdmin(event)
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const purged = await purgeArchivedTagsInTransaction(tx, data.ids)
      const singleTagId = data.ids.length === 1 ? data.ids[0] : undefined
      await tx.adminOperationLog.create({
        data: {
          adminId: admin.id,
          action: singleTagId ? 'PURGE_TAG' : 'PURGE_TAGS',
          targetType: 'Tag',
          targetId: singleTagId,
          content: `彻底删除 ${purged.purgedCount} 个归档标签（ID: ${data.ids.join(', ')}），移除 ${purged.removedGameAssociations} 个游戏关联，重置 ${purged.resetVndbMappings} 个 VNDB 映射`,
        },
      })
      return purged
    }, { maxWait: 10_000, timeout: 60_000 })
  } catch (error) {
    if (error instanceof TagPurgeRejectedError) {
      throw createError({ statusCode: error.statusCode, message: error.message })
    }
    throw error
  }

  await invalidateTagCaches()
  return {
    success: true,
    action: data.action,
    message: result.purgedCount === 1
      ? '标签已彻底删除'
      : `已彻底删除 ${result.purgedCount} 个标签`,
    ...result,
  }
})

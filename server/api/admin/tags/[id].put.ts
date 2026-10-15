import { TagDisplayTier } from '@prisma/client'
import { createError } from 'h3'
import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import { lockGameTagStatesInTransaction } from '~/server/utils/game-tag-source'
import prisma from '~/server/utils/prisma'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'
import {
  assertTagNamesAvailableInTransaction,
  InvalidCanonicalTagNameError,
  isPrismaUniqueConstraintError,
  lockTagNameNamespaceInTransaction,
  prepareTagNames,
  TagNameConflictError,
} from '~/server/utils/tag-name'
import {
  lockVndbTagMappingInTransaction,
  reconcileVndbTagSourcesInTransaction,
} from '~/server/utils/vndb-tag-sync'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNsfw: z.boolean().optional(),
  displayTier: z.nativeEnum(TagDisplayTier).optional(),
  aliases: z.array(z.string().min(1).max(100)).max(30).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的标签ID',
    })
  }

  try {
    const tag = await prisma.$transaction(async (tx) => {
      // Keep the adult-mapping invariant stable while checking whether this
      // canonical tag may be downgraded to SFW.
      if (data.isNsfw === false || data.displayTier !== undefined) {
        await lockVndbTagMappingInTransaction(tx)
      }
      await lockTagNameNamespaceInTransaction(tx)

      const existing = await tx.tag.findUnique({
        where: { id },
        include: { aliases: { select: { name: true } } },
      })
      if (!existing) {
        throw createError({ statusCode: 404, message: '标签不存在' })
      }

      if (data.isNsfw === false) {
        const adultMapping = await tx.vndbTag.findFirst({
          where: {
            tagId: id,
            status: 'MAPPED',
            isNsfw: true,
          },
          select: { id: true, nameEn: true },
        })
        if (adultMapping) {
          throw createError({
            statusCode: 409,
            message: `该标签仍映射成人 VNDB 标签 ${adultMapping.id}（${adultMapping.nameEn}），不能设为 SFW`,
          })
        }
      }

      let affectedGameIds: number[] = []
      if (data.displayTier !== undefined) {
        const affectedGames = await tx.gameVndbTag.findMany({
          where: { vndbTag: { tagId: id } },
          select: { gameId: true },
          distinct: ['gameId'],
          orderBy: { gameId: 'asc' },
        })
        affectedGameIds = affectedGames.map(game => game.gameId)
        await lockGameTagStatesInTransaction(tx, affectedGameIds)
        await tx.vndbTag.updateMany({
          where: { tagId: id },
          data: { displayTier: data.displayTier },
        })
      }

      const namesChanged = data.name !== undefined || data.aliases !== undefined
      const prepared = namesChanged
        ? prepareTagNames(
            data.name ?? existing.name,
            data.aliases ?? existing.aliases.map(alias => alias.name),
          )
        : null

      if (existing.isSystem && prepared && prepared.name !== existing.name) {
        throw createError({ statusCode: 409, message: '系统标签的规范名不能修改' })
      }

      if (prepared) {
        await assertTagNamesAvailableInTransaction(tx, prepared, id)
        await tx.tagAlias.deleteMany({ where: { tagId: id } })
      }

      const updated = await tx.tag.update({
        where: { id },
        data: {
          ...(prepared && { name: prepared.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.isNsfw !== undefined && { isNsfw: data.isNsfw }),
          ...(prepared && prepared.aliases.length > 0 && {
            aliases: { create: prepared.aliases },
          }),
        },
        include: { aliases: true },
      })

      if (data.displayTier !== undefined) {
        await reconcileVndbTagSourcesInTransaction(tx, {
          gameIds: affectedGameIds,
          alreadyLocked: true,
        })
      }

      return updated
    }, { maxWait: 10_000, timeout: 60_000 })

    await Promise.all([
      invalidateGameCaches(),
      invalidateCache('game:*'),
      invalidateCache('tags:*'),
    ])
    return tag
  } catch (error) {
    if (error instanceof InvalidCanonicalTagNameError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof TagNameConflictError) {
      throw createError({ statusCode: 409, message: error.message })
    }
    if (isPrismaUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, message: '标签名称、别名或标识已被占用' })
    }
    throw error
  }
})

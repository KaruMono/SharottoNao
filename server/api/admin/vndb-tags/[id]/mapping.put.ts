import { z } from 'zod'
import { TagDisplayTier, VndbTagStatus } from '@prisma/client'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/slug'
import { pickTagColor } from '~/server/utils/tag-color'
import {
  assertTagNamesAvailableInTransaction,
  InvalidCanonicalTagNameError,
  isPrismaUniqueConstraintError,
  lockTagNameNamespaceInTransaction,
  prepareTagNames,
  TagNameConflictError,
} from '~/server/utils/tag-name'
import { lockGameTagStatesInTransaction } from '~/server/utils/game-tag-source'
import {
  isAdultVndbTag,
  lockVndbTagMappingInTransaction,
  reconcileVndbTagSourcesInTransaction,
} from '~/server/utils/vndb-tag-sync'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'
import { logAdminOperation } from '~/server/utils/admin-operation-log'

const safetyFields = {
  isNsfw: z.boolean().optional(),
  affectsGameNsfw: z.boolean().optional(),
  displayTier: z.nativeEnum(TagDisplayTier).optional(),
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('map'),
    tagId: z.number().int().positive(),
    ...safetyFields,
  }),
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    aliases: z.array(z.string().trim().min(1).max(100)).max(30).optional().default([]),
    ...safetyFields,
  }),
  z.object({
    action: z.literal('ignore'),
    ...safetyFields,
  }),
  z.object({ action: z.literal('reset') }),
])

export default defineEventHandler(async (event) => {
  const editor = await requireEditor(event)
  const vndbTagId = getRouterParam(event, 'id')?.trim().toLowerCase()
  if (!vndbTagId || !/^g\d+$/.test(vndbTagId)) {
    throw createError({ statusCode: 400, message: '无效的 VNDB 标签 ID' })
  }

  const data = schema.parse(await readBody(event))

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Mapping needs a stable association set. Raw syncs take the shared side
      // of this lock before touching an existing Game row.
      await lockVndbTagMappingInTransaction(tx)

      const current = await tx.vndbTag.findUnique({
        where: { id: vndbTagId },
        select: {
          id: true,
          nameEn: true,
          category: true,
          isNsfw: true,
          affectsGameNsfw: true,
          displayTier: true,
        },
      })
      if (!current) {
        throw createError({ statusCode: 404, message: 'VNDB 标签不存在，请先同步游戏标签' })
      }

      // The exclusive mapping lock keeps this association snapshot stable.
      const games = await tx.gameVndbTag.findMany({
        where: { vndbTagId },
        select: { gameId: true },
        orderBy: { gameId: 'asc' },
      })
      await lockGameTagStatesInTransaction(tx, games.map(game => game.gameId))

      let tagId: number | null = null
      let status: VndbTagStatus = VndbTagStatus.PENDING
      let isNsfw: boolean | undefined
      let affectsGameNsfw: boolean | undefined
      const authoritativeAdult = isAdultVndbTag(current)

      if (data.action === 'map') {
        const tag = await tx.tag.findUnique({
          where: { id: data.tagId },
          select: { id: true, isSystem: true, archivedAt: true },
        })
        if (!tag || tag.archivedAt) {
          throw createError({ statusCode: 400, message: '目标中文标签不存在或已归档' })
        }
        if (tag.isSystem) {
          throw createError({ statusCode: 400, message: '系统标签不能作为 VNDB 映射目标' })
        }
        tagId = tag.id
        status = VndbTagStatus.MAPPED
        isNsfw = authoritativeAdult || (data.isNsfw ?? current.isNsfw)
        affectsGameNsfw = authoritativeAdult || (data.affectsGameNsfw ?? current.affectsGameNsfw)
      } else if (data.action === 'create') {
        await lockTagNameNamespaceInTransaction(tx)
        isNsfw = authoritativeAdult || (data.isNsfw ?? current.isNsfw)
        affectsGameNsfw = authoritativeAdult || (data.affectsGameNsfw ?? current.affectsGameNsfw)
        const prepared = prepareTagNames(data.name, data.aliases)
        await assertTagNamesAvailableInTransaction(tx, prepared)
        const slug = await generateUniqueSlug(prepared.name, async (candidate) => {
          return Boolean(await tx.tag.findUnique({ where: { slug: candidate }, select: { id: true } }))
        })
        const tag = await tx.tag.create({
          data: {
            name: prepared.name,
            slug,
            description: data.description || null,
            color: data.color || pickTagColor(prepared.name),
            isNsfw,
            aliases: prepared.aliases.length > 0
              ? { create: prepared.aliases }
              : undefined,
          },
        })
        tagId = tag.id
        status = VndbTagStatus.MAPPED
      } else if (data.action === 'ignore') {
        status = VndbTagStatus.IGNORED
        isNsfw = authoritativeAdult || (data.isNsfw ?? current.isNsfw)
        affectsGameNsfw = authoritativeAdult || (data.affectsGameNsfw ?? current.affectsGameNsfw)
      }

      if (tagId && isNsfw) {
        // Adult source mappings must not become publicly visible through a safe canonical tag.
        await tx.tag.update({ where: { id: tagId }, data: { isNsfw: true } })
      }

      const updated = await tx.vndbTag.update({
        where: { id: vndbTagId },
        data: {
          tagId,
          status,
          ...(isNsfw !== undefined && { isNsfw }),
          ...(affectsGameNsfw !== undefined && { affectsGameNsfw }),
          ...(data.action !== 'reset' && { displayTier: data.displayTier ?? current.displayTier }),
        },
        include: {
          tag: {
            select: { id: true, name: true, slug: true, color: true, isNsfw: true },
          },
        },
      })

      await reconcileVndbTagSourcesInTransaction(tx, {
        gameIds: games.map(game => game.gameId),
        alreadyLocked: true,
      })

      return { updated, affectedGameIds: games.map(game => game.gameId) }
    }, { maxWait: 10_000, timeout: 60_000 })

    await Promise.all([
      invalidateGameCaches(),
      invalidateCache('game:*'),
      invalidateCache('tags:*'),
    ])

    logAdminOperation({
      adminId: editor.id,
      action: 'UPDATE_VNDB_TAG_MAPPING',
      targetType: 'VndbTag',
      content: `${vndbTagId} 执行 ${data.action}，影响 ${result.affectedGameIds.length} 个游戏`,
    }).catch(() => {})

    return {
      ...result.updated,
      affectedGames: result.affectedGameIds.length,
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (error instanceof InvalidCanonicalTagNameError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof TagNameConflictError) {
      throw createError({ statusCode: 409, message: error.message })
    }
    if (isPrismaUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, message: '标签名称或别名已被占用' })
    }
    throw error
  }
})

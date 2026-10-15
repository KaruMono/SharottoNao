import { z } from 'zod'
import { invalidateGameCaches } from '~/server/utils/redis'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'
import { recordActivity } from '~/server/utils/activity'
import { fetchVndbGame, type VndbGameData } from '~/server/utils/vndb-client'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
} from '~/server/utils/vndb-tag-sync'

function parseReleaseDate(dateStr: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }
  const m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

const importItemSchema = z.object({
  vndbId: z.string().regex(/^v\d+$/).optional().nullable(),
  titleEn: z.string().optional().nullable(),
  titleJa: z.string().optional().nullable(),
  titleZhHans: z.string().optional().nullable(),
  titleZhHant: z.string().optional().nullable(),
  aliases: z.array(z.string()).optional().default([]),
  descriptionEn: z.string().optional().nullable(),
  descriptionZhHans: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
  isNsfw: z.boolean().optional().default(false),
  lengthMinutes: z.number().optional().nullable(),
  resources: z.array(z.object({
    typeId: z.number(),
    title: z.string(),
    url: z.string(),
    extractCode: z.string().optional().nullable(),
    unzipPassword: z.string().optional().nullable(),
    remark: z.string().optional().nullable(),
  })).optional().default([]),
  uploaderId: z.number().optional(),
})

const schema = z.object({
  items: z.array(importItemSchema).min(1).max(50),
  defaultUploaderId: z.number(),
  defaultResourceTypeId: z.number(),
  skipExisting: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)

  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '数据验证失败: ' + JSON.stringify(e.errors?.slice(0, 3)),
    })
  }

  const uploader = await prisma.user.findUnique({
    where: { id: data.defaultUploaderId },
  })
  if (!uploader) {
    throw createError({ statusCode: 400, message: '指定的资源发布者不存在' })
  }

  const resourceType = await prisma.resourceType.findUnique({
    where: { id: data.defaultResourceTypeId },
  })
  if (!resourceType) {
    throw createError({ statusCode: 400, message: '指定的资源类型不存在' })
  }

  const results: Array<{
    vndbId?: string | null
    title: string
    status: 'created' | 'skipped' | 'merged' | 'error'
    gameId?: number
    message?: string
    resourceCount?: number
  }> = []

  for (const item of data.items) {
    const displayTitle = item.titleZhHans || item.titleJa || item.titleEn || item.vndbId || '未知'

    try {
      // 1. 检查 VNDB ID 是否已存在
      let existingGame: { id: number } | null = null
      let matchReason = ''

      if (item.vndbId) {
        existingGame = await prisma.game.findFirst({
          where: { vndbId: item.vndbId, deletedAt: null },
        })
        if (existingGame) matchReason = 'VNDB ID 已存在'
      }

      // 2. 按标题检查是否已存在
      if (!existingGame) {
        const titleConditions: Array<Record<string, any>> = []
        if (item.titleEn) titleConditions.push(
          { titleEn: item.titleEn },
          { titleJa: item.titleEn },
          { titleZhHans: item.titleEn },
        )
        if (item.titleJa) titleConditions.push(
          { titleEn: item.titleJa },
          { titleJa: item.titleJa },
          { titleZhHans: item.titleJa },
        )
        if (item.titleZhHans) titleConditions.push(
          { titleEn: item.titleZhHans },
          { titleJa: item.titleZhHans },
          { titleZhHans: item.titleZhHans },
        )
        if (item.titleZhHant) titleConditions.push(
          { titleEn: item.titleZhHant },
          { titleJa: item.titleZhHant },
          { titleZhHans: item.titleZhHant },
          { titleZhHant: item.titleZhHant },
        )

        if (titleConditions.length > 0) {
          existingGame = await prisma.game.findFirst({
            where: { deletedAt: null, OR: titleConditions },
          })
          if (existingGame) matchReason = `标题与已有游戏重复 (ID: ${existingGame.id})`
        }
      }

      // 如果已存在，仅导入资源到已有游戏
      if (existingGame) {
        if (item.resources.length > 0) {
          const uploaderId = item.uploaderId || data.defaultUploaderId
          // 检查是否有重复 URL，避免重复导入
          const existingUrls = await prisma.resource.findMany({
            where: { gameId: existingGame.id },
            select: { url: true },
          })
          const existingUrlSet = new Set(existingUrls.map(r => r.url))
          const newResources = item.resources.filter(r => !existingUrlSet.has(r.url))

          if (newResources.length > 0) {
            await prisma.resource.createMany({
              data: newResources.map(res => ({
                gameId: existingGame!.id,
                typeId: res.typeId || data.defaultResourceTypeId,
                uploaderId,
                title: res.title,
                url: res.url,
                extractCode: res.extractCode || null,
                unzipPassword: res.unzipPassword || null,
                remark: res.remark || null,
                status: 'APPROVED' as const,
              })),
            })
            await invalidateGameCaches(existingGame.id)
            results.push({
              vndbId: item.vndbId,
              title: displayTitle,
              status: 'merged',
              gameId: existingGame.id,
              resourceCount: newResources.length,
              message: `${matchReason}，已追加 ${newResources.length} 个资源`,
            })
            continue
          }
        }
        results.push({
          vndbId: item.vndbId,
          title: displayTitle,
          status: 'skipped',
          gameId: existingGame.id,
          message: `${matchReason}，无新资源可导入`,
        })
        continue
      }

      // 3. 验证至少有一个标题
      if (!item.titleEn && !item.titleJa && !item.titleZhHans && !item.titleZhHant) {
        results.push({
          vndbId: item.vndbId,
          title: displayTitle,
          status: 'error',
          message: '缺少标题',
        })
        continue
      }

      // 4. 验证至少有一个简介
      if (!item.descriptionEn && !item.descriptionZhHans) {
        results.push({
          vndbId: item.vndbId,
          title: displayTitle,
          status: 'error',
          message: '缺少简介',
        })
        continue
      }

      // 5. 在事务中创建游戏 + 资源 + 编辑记录
      const uploaderId = item.uploaderId || data.defaultUploaderId
      let vndbData: VndbGameData | null = null
      if (item.vndbId) {
        vndbData = await fetchVndbGame(item.vndbId)
      }

      const game = await prisma.$transaction(async (tx) => {
        if (vndbData) {
          await lockVndbTagSyncInTransaction(tx)
        }

        const g = await tx.game.create({
          data: {
            titleEn: item.titleEn || null,
            titleJa: item.titleJa || null,
            titleZhHans: item.titleZhHans || null,
            titleZhHant: item.titleZhHant || null,
            aliases: item.aliases,
            descriptionEn: item.descriptionEn || null,
            descriptionZhHans: item.descriptionZhHans || null,
            coverImage: item.coverImage || null,
            releaseDate: item.releaseDate ? parseReleaseDate(item.releaseDate) : null,
            isNsfw: item.isNsfw || Boolean(vndbData?.isNsfw),
            vndbId: item.vndbId || null,
            lengthMinutes: item.lengthMinutes || null,
            creatorId: admin.id,
          },
        })

        if (item.resources.length > 0) {
          await tx.resource.createMany({
            data: item.resources.map(res => ({
              gameId: g.id,
              typeId: res.typeId || data.defaultResourceTypeId,
              uploaderId,
              title: res.title,
              url: res.url,
              extractCode: res.extractCode || null,
              unzipPassword: res.unzipPassword || null,
              remark: res.remark || null,
              status: 'APPROVED' as const,
            })),
          })
        }

        if (vndbData) {
          await syncVndbTagsForGameInTransaction(tx, {
            gameId: g.id,
            tags: vndbData.tags,
          })
        }

        return g
      })

      await invalidateGameCaches(game.id)

      if (game.coverImage) {
        await markImageAsUsed(game.coverImage, game.id)
      }

      recordActivity({
        userId: admin.id,
        type: 'CREATE_GAME',
        targetType: 'game',
        targetId: game.id,
        meta: {
          gameTitle: displayTitle,
          gameCover: game.coverImage,
        },
      })

      results.push({
        vndbId: item.vndbId,
        title: displayTitle,
        status: 'created',
        gameId: game.id,
        resourceCount: item.resources.length,
      })
    } catch (err: any) {
      results.push({
        vndbId: item.vndbId,
        title: displayTitle,
        status: 'error',
        message: err.message || '未知错误',
      })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const merged = results.filter(r => r.status === 'merged').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors = results.filter(r => r.status === 'error').length

  return {
    summary: { total: results.length, created, merged, skipped, errors },
    results,
  }
})

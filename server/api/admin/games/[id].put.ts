import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused, markImagesAsUsed } from '~/server/utils/image'
import { recordEdit } from '~/server/utils/content-edit'
import { recordActivity } from '~/server/utils/activity'
import { diffGame } from '~/server/utils/game-diff'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { invalidateGameCaches } from '~/server/utils/redis'
import { normalizeTagNames } from '~/server/utils/tag-normalize'
import { pickTagColor } from '~/server/utils/tag-color'
import { generateUniqueSlug } from '~/server/utils/slug'

const staffSchema = z.object({
  role: z.enum(['ARTIST', 'WRITER', 'COMPOSER', 'VOICE_ACTOR', 'DIRECTOR', 'OTHER']),
  name: z.string(),
  nameOriginal: z.string().optional(),
  characterName: z.string().optional(),
  staffId: z.number().optional(),
})

const companySchema = z.object({
  companyId: z.number(),
  role: z.enum(['DEVELOPER', 'PUBLISHER']),
})

const purchaseLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
})

const schema = z.object({
  titleEn: z.string().max(255).optional().nullable(),
  titleJa: z.string().max(255).optional().nullable(),
  titleZhHans: z.string().max(255).optional().nullable(),
  titleZhHant: z.string().max(255).optional().nullable(),
  aliases: z.array(z.string().max(255)).optional().default([]),
  descriptionEn: z.string().optional().nullable(),
  descriptionJa: z.string().optional().nullable(),
  descriptionZhHans: z.string().optional().nullable(),
  descriptionZhHant: z.string().optional().nullable(),
  coverImage: z.string().max(500),
  releaseDate: z.string().optional().nullable(),
  companies: z.array(companySchema).optional().default([]),
  tagIds: z.array(z.number()).optional().default([]),
  // 管理员直接创建新标签（保存时即时生效，无需审核）
  newTagNames: z.array(z.string().min(1).max(100)).max(20).optional(),
  isNsfw: z.boolean().optional().default(false),
  vndbId: z.string().max(20).optional().nullable(),
  bangumiId: z.number().optional().nullable(),
  screenshots: z.array(z.string().max(500)).optional().default([]),
  staff: z.array(staffSchema).optional().default([]),
  purchaseLinks: z.array(purchaseLinkSchema).optional().default([]),
  seriesId: z.number().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const existingGame = await prisma.game.findUnique({
    where: { id },
    include: {
      screenshots: true,
      tags: { select: { tagId: true } },
      companies: { select: { companyId: true, role: true } },
      staff: { select: { staffId: true, role: true, characterName: true } },
    },
  })

  if (!existingGame) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  const body = await readBody(event)
  
  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    console.error('Validation error:', e.errors)
    throw createError({
      statusCode: 400,
      message: '数据验证失败: ' + JSON.stringify(e.errors),
    })
  }

  // 验证至少有一个标题
  if (!data.titleEn && !data.titleJa && !data.titleZhHans && !data.titleZhHant) {
    throw createError({
      statusCode: 400,
      message: '至少需要填写一个语言的标题',
    })
  }

  // 验证至少有一个简介
  if (!data.descriptionEn && !data.descriptionJa && !data.descriptionZhHans && !data.descriptionZhHant) {
    throw createError({
      statusCode: 400,
      message: '至少需要填写一个语言的简介',
    })
  }

  // 检查 vndbId 唯一性
  if (data.vndbId) {
    const duplicateVndb = await prisma.game.findFirst({
      where: { vndbId: data.vndbId, id: { not: id } },
      select: { id: true },
    })
    if (duplicateVndb) {
      throw createError({
        statusCode: 400,
        message: `VNDB ID「${data.vndbId}」已被其他条目（ID: ${duplicateVndb.id}）使用`,
      })
    }
  }

  // 检查 bangumiId 唯一性
  if (data.bangumiId) {
    const duplicateBgm = await prisma.game.findFirst({
      where: { bangumiId: data.bangumiId, id: { not: id } },
      select: { id: true },
    })
    if (duplicateBgm) {
      throw createError({
        statusCode: 400,
        message: `Bangumi ID「${data.bangumiId}」已被其他条目（ID: ${duplicateBgm.id}）使用`,
      })
    }
  }

  // 使用事务更新所有数据
  try {
  await prisma.$transaction(async (tx) => {
    // 更新游戏基本信息
    await tx.game.update({
      where: { id },
      data: {
        titleEn: data.titleEn || null,
        titleJa: data.titleJa || null,
        titleZhHans: data.titleZhHans || null,
        titleZhHant: data.titleZhHant || null,
        aliases: data.aliases || [],
        descriptionEn: data.descriptionEn || null,
        descriptionJa: data.descriptionJa || null,
        descriptionZhHans: data.descriptionZhHans || null,
        descriptionZhHant: data.descriptionZhHant || null,
        coverImage: data.coverImage,
        releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
        isNsfw: data.isNsfw ?? existingGame.isNsfw,
        vndbId: data.vndbId || null,
        bangumiId: data.bangumiId || null,
        seriesId: data.seriesId !== undefined ? (data.seriesId || null) : undefined,
        purchaseLinks: data.purchaseLinks || [],
      },
    })

    // 更新会社关联（多对多）
    if (data.companies !== undefined) {
      await tx.gameCompany.deleteMany({
        where: { gameId: id },
      })

      if (data.companies.length > 0) {
        await tx.gameCompany.createMany({
          data: data.companies.map(c => ({
            gameId: id,
            companyId: c.companyId,
            role: c.role,
          })),
        })
      }
    }

    // 更新标签关联
    let finalTagIds = data.tagIds ?? []
    if (data.newTagNames?.length) {
      const normalized = normalizeTagNames(data.newTagNames)
      const newIds: number[] = []
      for (const name of normalized) {
        let tag = await tx.tag.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        })
        if (!tag) {
          const slug = await generateUniqueSlug(name, async (s) => {
            const exists = await tx.tag.findFirst({ where: { slug: s } })
            return !!exists
          })
          tag = await tx.tag.create({
            data: { name, slug, isNsfw: false, color: pickTagColor(name) },
          })
        }
        newIds.push(tag.id)
      }
      finalTagIds = [...new Set([...finalTagIds, ...newIds])]
    }

    if (data.tagIds !== undefined || data.newTagNames?.length) {
      await tx.gameTag.deleteMany({ where: { gameId: id } })
      if (finalTagIds.length > 0) {
        await tx.gameTag.createMany({
          data: finalTagIds.map(tagId => ({ gameId: id, tagId })),
        })
      }
    }

    // 更新截图
    if (data.screenshots !== undefined) {
      // 删除旧截图
      await tx.screenshot.deleteMany({
        where: { gameId: id },
      })

      // 创建新截图
      if (data.screenshots.length > 0) {
        await tx.screenshot.createMany({
          data: data.screenshots.map((url, index) => ({
            gameId: id,
            url,
            sortOrder: index,
          })),
        })
      }
    }

    // 更新 STAFF
    if (data.staff !== undefined) {
      // 删除旧的 STAFF 关联
      await tx.gameStaff.deleteMany({
        where: { gameId: id },
      })

      // 创建新的 STAFF
      for (const staffData of data.staff) {
        let staffId = staffData.staffId

        // 如果没有 staffId，创建新的 Staff 记录
        if (!staffId) {
          const existingStaff = await tx.staff.findFirst({
            where: { name: staffData.name },
          })

          if (existingStaff) {
            staffId = existingStaff.id
          } else {
            const newStaff = await tx.staff.create({
              data: {
                name: staffData.name,
                nameOriginal: staffData.nameOriginal || null,
              },
            })
            staffId = newStaff.id
          }
        }

        // 创建关联
        await tx.gameStaff.create({
          data: {
            gameId: id,
            staffId,
            role: staffData.role,
            characterName: staffData.characterName || null,
          },
        })
      }
    }

    // 管理员后台编辑不记录到编辑历史
  })

  // 计算详细变更
  const { changes, summary } = diffGame(
    existingGame as unknown as Record<string, unknown>,
    { ...data, tagIds: data.tagIds, screenshots: data.screenshots, staff: data.staff, companies: data.companies },
    '管理员编辑游戏条目',
  )

  // 记录编辑历史快照（编辑前的版本 + 变更详情）
  await recordEdit({
    targetType: 'GAME',
    targetId: id,
    editorId: user.id,
    snapshot: {
      ...(existingGame as unknown as Record<string, unknown>),
      _changes: changes,
    },
    changeSummary: summary,
  })

  // 记录活动流
  recordActivity({
    userId: user.id,
    type: 'EDIT_GAME',
    targetType: 'game',
    targetId: id,
    meta: {
      gameTitle: existingGame.titleZhHans || existingGame.titleJa || existingGame.titleEn || `Game #${id}`,
      changedFields: changes.map(c => c.label),
    },
  })

  // 更新图片使用状态
  // 封面图
  if (existingGame.coverImage !== data.coverImage) {
    await markImageAsUnused(existingGame.coverImage)
    await markImageAsUsed(data.coverImage, id)
  }

  // 截图
  if (data.screenshots !== undefined) {
    const oldScreenshotUrls = existingGame.screenshots.map(s => s.url)
    const newScreenshotUrls = data.screenshots

    // 标记被移除的截图为未使用
    for (const url of oldScreenshotUrls) {
      if (!newScreenshotUrls.includes(url)) {
        await markImageAsUnused(url)
      }
    }

    // 标记新增的截图为已使用
    for (const url of newScreenshotUrls) {
      if (!oldScreenshotUrls.includes(url)) {
        await markImageAsUsed(url, id)
      }
    }
  }
  } catch (e: any) {
    console.error('Database error:', e)
    throw createError({
      statusCode: 500,
      message: '数据库错误: ' + e.message,
    })
  }

  submitGameToIndexNow(id, 'UPDATE').catch(err => console.error('IndexNow submission failed:', err))
  invalidateGameCaches(id).catch(() => {})

  return { success: true }
})

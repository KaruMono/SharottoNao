import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { buildGameEditChanges } from '~/server/utils/edit-request'
import { normalizeTagNames, findTagByName } from '~/server/utils/tag-normalize'

const schema = z.object({
  titleEn: z.string().optional(),
  titleJa: z.string().optional(),
  titleZhHans: z.string().optional(),
  titleZhHant: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  descriptionEn: z.string().optional(),
  descriptionJa: z.string().optional(),
  descriptionZhHans: z.string().optional(),
  descriptionZhHant: z.string().optional(),
  coverImage: z.string().optional(),
  releaseDate: z.string().optional(),
  companies: z.array(z.object({
    companyId: z.number(),
    role: z.string(),
    name: z.string().optional(),
  })).optional(),
  tagIds: z.array(z.number()).optional(),
  // 玩家自由输入的标签名（不受现有词表限制），审核通过时才会真正创建
  newTagNames: z.array(z.string().min(1).max(100)).max(10).optional(),
  isNsfw: z.boolean().optional(),
  vndbId: z.string().optional(),
  bangumiId: z.number().optional(),
  seriesId: z.number().int().positive().nullable().optional(),
  lengthMinutes: z.number().int().nonnegative().nullable().optional(),
  purchaseLinks: z.array(z.object({
    name: z.string(),
    url: z.string(),
  })).optional(),
  staff: z.array(z.object({
    id: z.number().optional(),
    name: z.string(),
    nameOriginal: z.string().optional(),
    role: z.string(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(gameId)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
    include: {
      tags: { include: { tag: true } },
      staff: { include: { staff: true } },
      companies: { include: { company: { select: { name: true } } } },
    },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  // 自由输入的标签名：先归一化去重，再逐个查词表。
  // 已存在的（忽略大小写/全角差异）直接归位到 tagIds，不必让管理员再处理一遍；
  // 只有词表里确实没有的才留在 newTagNames 等审核时创建。
  if (data.newTagNames?.length) {
    // 未提交 tagIds 时以条目现有标签为种子，避免「只想加一个标签」
    // 被算成「删掉原有全部标签只留这一个」
    const tagIds = new Set(data.tagIds ?? game.tags.map(t => t.tagId))
    const pendingNames: string[] = []

    for (const name of normalizeTagNames(data.newTagNames)) {
      const existing = await findTagByName(name)
      if (existing) {
        tagIds.add(existing.id)
      } else {
        pendingNames.push(name)
      }
    }

    data.tagIds = [...tagIds]
    data.newTagNames = pendingNames
  }

  // 计算变更内容（统一逻辑，含日期归一化、会社、vndbId 等字段）
  const changes = buildGameEditChanges(game as any, data)

  // 如果没有任何变更
  if (Object.keys(changes).length === 0) {
    throw createError({
      statusCode: 400,
      message: '没有检测到任何修改',
    })
  }

  // 检查是否有待处理的编辑请求
  const pendingRequest = await prisma.gameEditRequest.findFirst({
    where: {
      gameId,
      userId: user.id,
      status: 'PENDING',
    },
  })

  if (pendingRequest) {
    throw createError({
      statusCode: 400,
      message: '您已有一个待审核的修改请求，请等待处理后再提交',
    })
  }

  // 创建编辑请求
  const editRequest = await prisma.gameEditRequest.create({
    data: {
      gameId,
      userId: user.id,
      changes: changes as unknown as Prisma.InputJsonObject,
    },
  })

  return editRequest
})

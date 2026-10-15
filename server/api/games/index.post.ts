import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { getDisplayTitle } from '~/server/utils/game'
import { markImageAsUsed } from '~/server/utils/image'
import { invalidateCache } from '~/server/utils/redis'
import { recordActivity } from '~/server/utils/activity'
import { submitGameToIndexNow } from '~/server/utils/indexnow'
import { normalizeTagNames } from '~/server/utils/tag-normalize'
import {
  isPrismaUniqueConstraintError,
  resolveOrCreateTagByNameInTransaction,
  TagNameConflictError,
} from '~/server/utils/tag-name'
import { fetchVndbGame, type VndbGameData } from '~/server/utils/vndb-client'
import { replaceManualGameTagsInTransaction } from '~/server/utils/game-tag-source'
import { ensureGameStaffRelation } from '~/server/utils/game-staff'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
} from '~/server/utils/vndb-tag-sync'

const schema = z.object({
  // 多语言标题（至少填写一个）
  titleEn: z.string().max(255).optional(),
  titleJa: z.string().max(255).optional(),
  titleZhHans: z.string().max(255).optional(),
  titleZhHant: z.string().max(255).optional(),
  
  aliases: z.array(z.string()).optional(),
  
  // 多语言简介（至少填写一个）
  descriptionEn: z.string().optional(),
  descriptionJa: z.string().optional(),
  descriptionZhHans: z.string().optional(),
  descriptionZhHant: z.string().optional(),
  
  coverImage: z.string().min(1, '请上传封面图'),
  bannerImage: z.string().optional(),
  releaseDate: z.string().optional(),
  language: z.array(z.string()).optional(),
  isNsfw: z.boolean().default(false),
  // 购买链接
  purchaseLinks: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
  // 以下字段仅管理员可设置（会社使用多对多关系）
  companies: z.array(z.object({
    companyId: z.number(),
    role: z.enum(['DEVELOPER', 'PUBLISHER']),
  })).optional(),
  tagIds: z.array(z.number()).optional(),
  // 管理员创建条目时可直接输入新标签名（即时创建，无需审核）
  newTagNames: z.array(z.string().min(1).max(100)).max(20).optional(),
  staff: z.array(z.object({
    staffId: z.number().optional(),
    name: z.string().optional(),
    nameOriginal: z.string().optional(),
    role: z.enum(['ARTIST', 'WRITER', 'COMPOSER', 'VOICE_ACTOR', 'DIRECTOR', 'OTHER']),
  })).optional(),
  // 外部平台 ID（普通用户必须提供其中之一）
  vndbId: z.string().regex(/^v\d+$/, 'VNDB ID 格式错误').optional(),
  bangumiId: z.number().optional(),
  // 管理员跳过外部 ID 验证的标记
  skipExternalId: z.boolean().optional(),
  // 从 VNDB 获取的厂商信息（前端传递，后端自动匹配）
  vndbDevelopers: z.array(z.object({
    name: z.string(),
    nameOriginal: z.string().nullable().optional(),
  })).optional(),
})

// getDisplayTitle 已从 ~/server/utils/game 导入

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  // 验证至少有一个标题
  if (!data.titleEn && !data.titleJa && !data.titleZhHans && !data.titleZhHant) {
    throw createError({
      statusCode: 400,
      message: '请至少填写一个语言的标题',
    })
  }

  // 验证至少有一个简介
  if (!data.descriptionEn && !data.descriptionJa && !data.descriptionZhHans && !data.descriptionZhHant) {
    throw createError({
      statusCode: 400,
      message: '请至少填写一个语言的简介',
    })
  }

  // 普通用户必须提供 VNDB ID 或 Bangumi ID
  const isAdmin = user.role === 'ADMIN'
  if (!isAdmin && !data.skipExternalId) {
    if (!data.vndbId && !data.bangumiId) {
      throw createError({
        statusCode: 400,
        message: '请提供 VNDB ID 或 Bangumi ID。如需创建不在这两个平台的游戏，请联系管理员。',
      })
    }
  }

  // 检查 VNDB ID 是否已存在（包括软删除条目，因数据库唯一约束不区分删除状态）
  if (data.vndbId) {
    const existing = await prisma.game.findFirst({
      where: { vndbId: data.vndbId },
    })
    if (existing) {
      const existingTitle = getDisplayTitle({
        titleEn: existing.titleEn ?? null,
        titleJa: existing.titleJa ?? null,
        titleZhHans: existing.titleZhHans ?? null,
        titleZhHant: existing.titleZhHant ?? null,
      })
      throw createError({
        statusCode: 400,
        message: existing.deletedAt
          ? `该 VNDB ID 已被已删除的条目占用（${existingTitle} #${existing.id}），请联系管理员清理`
          : `该 VNDB ID 已被使用，对应条目：${existingTitle}`,
      })
    }
  }

  // 检查 Bangumi ID 是否已存在（包括软删除条目）
  if (data.bangumiId) {
    const existing = await prisma.game.findFirst({
      where: { bangumiId: data.bangumiId },
    })
    if (existing) {
      const existingTitle = getDisplayTitle({
        titleEn: existing.titleEn ?? null,
        titleJa: existing.titleJa ?? null,
        titleZhHans: existing.titleZhHans ?? null,
        titleZhHant: existing.titleZhHant ?? null,
      })
      throw createError({
        statusCode: 400,
        message: existing.deletedAt
          ? `该 Bangumi ID 已被已删除的条目占用（${existingTitle} #${existing.id}），请联系管理员清理`
          : `该 Bangumi ID 已被使用，对应条目：${existingTitle}`,
      })
    }
  }

  // 服务端重新读取 VNDB，避免信任浏览器提交的标签快照。
  let vndbData: VndbGameData | null = null
  if (data.vndbId) {
    vndbData = await fetchVndbGame(data.vndbId)
  }

  // 创建游戏条目（与会社/标签关联放在同一事务中，避免部分写入）
  let game: Awaited<ReturnType<typeof prisma.game.create>>
  try {
    game = await prisma.$transaction(async (tx) => {
      if (vndbData) {
        await lockVndbTagSyncInTransaction(tx)
      }

      const created = await tx.game.create({
        data: {
          titleEn: data.titleEn ?? null,
          titleJa: data.titleJa ?? null,
          titleZhHans: data.titleZhHans ?? null,
          titleZhHant: data.titleZhHant ?? null,
          aliases: data.aliases ?? [],
          descriptionEn: data.descriptionEn ?? null,
          descriptionJa: data.descriptionJa ?? null,
          descriptionZhHans: data.descriptionZhHans ?? null,
          descriptionZhHant: data.descriptionZhHant ?? null,
          coverImage: data.coverImage,
          bannerImage: data.bannerImage,
          releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
          language: data.language ?? [],
          // VNDB is fetched again on the server, so a client cannot suppress
          // an upstream adult signal by tampering with the submitted form.
          isNsfw: data.isNsfw || Boolean(vndbData?.isNsfw),
          purchaseLinks: data.purchaseLinks ?? [],
          creatorId: user.id,
          vndbId: data.vndbId,
          bangumiId: data.bangumiId,
        },
      })

      // 添加会社关联（仅管理员可设置）
      if (isAdmin && data.companies && data.companies.length > 0) {
        await tx.gameCompany.createMany({
          data: data.companies.map(c => ({
            gameId: created.id,
            companyId: c.companyId,
            role: c.role,
          })),
        })
      }

      // 添加标签关联（仅管理员可设置）
      if (isAdmin) {
        let finalTagIds = data.tagIds ?? []

        // 处理 newTagNames：直接创建，无需审核
        if (data.newTagNames?.length) {
          const normalized = normalizeTagNames(data.newTagNames)
          const newIds: number[] = []
          for (const name of normalized) {
            const { tag } = await resolveOrCreateTagByNameInTransaction(tx, {
              name,
              isNsfw: false,
            })
            newIds.push(tag.id)
          }
          finalTagIds = [...new Set([...finalTagIds, ...newIds])]
        }

        await replaceManualGameTagsInTransaction(tx, created.id, finalTagIds)
      }

      if (vndbData) {
        await syncVndbTagsForGameInTransaction(tx, {
          gameId: created.id,
          tags: vndbData.tags,
        })
      }

      return created
    })
  } catch (e: any) {
    if (e?.code === 'P2002' && (e?.meta?.target?.includes('vndbId') || e?.meta?.target?.includes('bangumiId'))) {
      const field = e?.meta?.target?.includes('vndbId') ? 'VNDB ID' : 'Bangumi ID'
      throw createError({ statusCode: 400, message: `${field} 已被其他条目占用，请检查是否重复` })
    }
    if (isPrismaUniqueConstraintError(e)) {
      throw createError({ statusCode: 409, message: '标签名称、别名或标识已被占用' })
    }
    if (e instanceof TagNameConflictError) {
      throw createError({ statusCode: 409, message: e.message })
    }
    throw e
  }

  // 添加STAFF关联（仅管理员可设置）
  if (isAdmin && data.staff && data.staff.length > 0) {
    for (const s of data.staff) {
      let staffId = s.staffId
      // 如果没有 staffId，按名称查找或创建
      if (!staffId && s.name) {
        const existing = await prisma.staff.findFirst({
          where: { name: s.name },
        })
        if (existing) {
          staffId = existing.id
        } else {
          const created = await prisma.staff.create({
            data: {
              name: s.name,
              nameOriginal: s.nameOriginal || null,
            },
          })
          staffId = created.id
        }
      }
      if (staffId) {
        await ensureGameStaffRelation(prisma, {
          gameId: game.id,
          staffId,
          role: s.role,
        })
      }
    }
  }

  // 自动从 VNDB 补全 Staff 和会社（若提供了 VNDB ID）
  if (vndbData) {
    try {
      // 补全 Staff（不覆盖管理员已手动设置的，重复条目数据库会忽略）
      for (const s of (vndbData.staff || [])) {
        if (!s.name) continue
        try {
          let staffRecord = await prisma.staff.findFirst({ where: { name: s.name } })
          if (!staffRecord) {
            staffRecord = await prisma.staff.create({
              data: { name: s.name, nameOriginal: s.nameOriginal || null },
            })
          }
          await ensureGameStaffRelation(prisma, {
            gameId: game.id,
            staffId: staffRecord.id,
            role: s.role,
            characterName: s.characterName,
          })
        } catch {}
      }

      // 匹配会社（仅匹配已有会社，不新建）
      const vndbDevelopers: Array<{ name: string; nameOriginal: string | null }> = vndbData.developers || []
      if (vndbDevelopers.length) {
        const allCompanies = await prisma.company.findMany({
          select: { id: true, name: true, nameOriginal: true, aliases: true },
        })
        for (const dev of vndbDevelopers) {
          const devNames = [dev.name, dev.nameOriginal]
            .filter((n): n is string => !!n)
            .map(n => n.toLowerCase().trim())
          const matched = allCompanies.find(c => {
            const siteNames = [c.name, c.nameOriginal, ...c.aliases]
              .filter((n): n is string => !!n)
              .map(n => n.toLowerCase().trim())
            return devNames.some(dn => siteNames.includes(dn))
          })
          if (matched) {
            await prisma.gameCompany.upsert({
              where: { gameId_companyId: { gameId: game.id, companyId: matched.id } },
              create: { gameId: game.id, companyId: matched.id, role: 'DEVELOPER' },
              update: {},
            }).catch(() => {})
          }
        }
      }
    } catch {}
  }

  // 如果前端传递了 vndbDevelopers（即使没有 vndbId，也可能是之前获取过的数据）
  if (!vndbData && data.vndbDevelopers && data.vndbDevelopers.length > 0) {
    try {
      const allCompanies = await prisma.company.findMany({
        select: { id: true, name: true, nameOriginal: true, aliases: true },
      })
      for (const dev of data.vndbDevelopers) {
        const devNames = [dev.name, dev.nameOriginal]
          .filter((n): n is string => !!n)
          .map(n => n.toLowerCase().trim())
        const matched = allCompanies.find(c => {
          const siteNames = [c.name, c.nameOriginal, ...c.aliases]
            .filter((n): n is string => !!n)
            .map(n => n.toLowerCase().trim())
          return devNames.some(dn => siteNames.includes(dn))
        })
        if (matched) {
          await prisma.gameCompany.upsert({
            where: { gameId_companyId: { gameId: game.id, companyId: matched.id } },
            create: { gameId: game.id, companyId: matched.id, role: 'DEVELOPER' },
            update: {},
          }).catch(() => {})
        }
      }
    } catch {}
  }

  // 记录活动流
  recordActivity({
    userId: user.id,
    type: 'CREATE_GAME',
    targetType: 'game',
    targetId: game.id,
    meta: {
      gameTitle: getDisplayTitle(game),
      gameCover: game.coverImage,
    },
  })

  // 标记封面图为已使用
  await markImageAsUsed(data.coverImage, game.id)
  if (data.bannerImage) {
    await markImageAsUsed(data.bannerImage, game.id)
  }

  // 清除首页缓存，让新条目立即可见
  await invalidateCache('home:*')

  // 向搜索引擎提交新页面
  submitGameToIndexNow(game.id, 'ADD').catch(err => {
    console.error('IndexNow submission failed:', err)
  })

  return { id: game.id, message: '创建成功' }
})

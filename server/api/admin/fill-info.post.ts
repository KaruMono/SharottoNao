import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import { syncVndbTagsForGame } from '~/server/utils/vndb-tag-sync'
import { ensureGameStaffRelation } from '~/server/utils/game-staff'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const gameId = Number(body?.gameId)
  if (!gameId) throw createError({ statusCode: 400, message: 'gameId 必填' })
  const fillStaff: boolean = body?.fillStaff !== false
  const fillCompany: boolean = body?.fillCompany !== false
  const fillTags: boolean = body?.fillTags !== false

  const game = await prisma.game.findFirst({
    where: { id: gameId, deletedAt: null },
    select: { id: true, vndbId: true, titleZhHans: true, titleJa: true, titleEn: true },
  })
  if (!game || !game.vndbId) throw createError({ statusCode: 404, message: '游戏不存在或无 VNDB ID' })

  const label = game.titleZhHans || game.titleJa || game.titleEn || `#${game.id}`
  const log: string[] = []

  // 拉取 VNDB 数据
  let vndbData: any
  try {
    vndbData = await fetchVndbGame(game.vndbId)
  } catch (e: any) {
    throw createError({ statusCode: 502, message: `VNDB 请求失败：${e.message || e}` })
  }

  // ── 1. 更新制作人员 ────────────────────────────────────
  let staffAdded = 0
  if (fillStaff) {
    await prisma.gameStaff.deleteMany({ where: { gameId: game.id } })

    const staffList: Array<{ name: string; nameOriginal: string | null; role: string; characterName: string | null }> = vndbData.staff || []
    for (const s of staffList) {
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
        staffAdded++
      } catch {}
    }
    log.push(`制作人员：新增 ${staffAdded} 条`)
  }

  // ── 2. 匹配会社 ────────────────────────────────────────
  const developerList: Array<{ name: string; nameOriginal: string | null }> = vndbData.developers || []
  let companiesMatched = 0

  if (fillCompany && developerList.length) {
    // 一次性拿所有会社（数量有限，放内存匹配）
    const allCompanies = await prisma.company.findMany({
      select: { id: true, name: true, nameOriginal: true, aliases: true },
    })

    for (const dev of developerList) {
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
        try {
          await prisma.gameCompany.upsert({
            where: { gameId_companyId: { gameId: game.id, companyId: matched.id } },
            create: { gameId: game.id, companyId: matched.id, role: 'DEVELOPER' },
            update: { role: 'DEVELOPER' },
          })
          companiesMatched++
          log.push(`会社匹配：${dev.name} → ${matched.name}`)
        } catch {}
      }
    }

    if (companiesMatched === 0) log.push(`会社：无匹配（VNDB 有 ${developerList.length} 条开发商）`)
  } else if (fillCompany) {
    log.push('会社：VNDB 无开发商数据')
  }

  // ── 3. 保存 VNDB 原始标签并应用已审核映射 ───────────────
  let tagsSynced = 0
  let tagsApplied = 0
  let tagsPending = 0
  let suggestsGameNsfw = false
  if (fillTags) {
    const result = await syncVndbTagsForGame({
      gameId: game.id,
      tags: vndbData.tags || [],
      expectedVndbId: game.vndbId,
    })
    tagsSynced = result.rawTagCount
    tagsApplied = result.appliedTagIds.length
    tagsPending = result.pendingVndbTagIds.length
    suggestsGameNsfw = result.suggestsGameNsfw
    log.push(`VNDB 标签：同步 ${tagsSynced} 条，应用 ${tagsApplied} 个中文标签，待处理 ${tagsPending} 条`)
  }

  return {
    gameId: game.id,
    label,
    staffAdded,
    companiesMatched,
    tagsSynced,
    tagsApplied,
    tagsPending,
    suggestsGameNsfw,
    log,
  }
})

import type { ContentEditType, Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { invalidateGameCaches } from '~/server/utils/redis'
import { fetchVndbGame } from '~/server/utils/vndb-client'
import {
  lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction,
} from '~/server/utils/vndb-tag-sync'

/**
 * 在编辑前记录快照
 */
export async function recordEdit(params: {
  targetType: ContentEditType
  targetId: number
  editorId?: number | null
  snapshot: Record<string, unknown>
  changeSummary?: string
  isRevert?: boolean
}) {
  const { targetType, targetId, editorId, snapshot, changeSummary, isRevert } = params
  return prisma.contentEdit.create({
    data: {
      targetType,
      targetId,
      editorId: editorId ?? null,
      snapshot: snapshot as Prisma.InputJsonObject,
      changeSummary: changeSummary ?? null,
      isRevert: isRevert ?? false,
    },
  })
}

/**
 * 将某条编辑历史记录的快照写回到对应模型
 * 撤销时：先保存当前版本快照，再恢复目标快照
 */
export async function revertToSnapshot(editId: number, operatorId: number): Promise<void> {
  const edit = await prisma.contentEdit.findUnique({ where: { id: editId } })
  if (!edit) {
    throw createError({ statusCode: 404, message: '编辑记录不存在' })
  }

  const snapshot = edit.snapshot as Record<string, unknown>

  if (edit.targetType === 'GAME') {
    const current = await prisma.game.findUnique({
      where: { id: edit.targetId },
      include: {
        tags: { select: { tagId: true } },
        companies: { select: { companyId: true, role: true } },
        screenshots: { select: { url: true, sortOrder: true } },
        staff: { select: { staffId: true, role: true, characterName: true } },
      },
    })
    if (!current) throw createError({ statusCode: 404, message: '游戏条目不存在' })

    const snapshotVndbId = typeof snapshot.vndbId === 'string' && snapshot.vndbId
      ? snapshot.vndbId
      : null
    const vndbChanged = snapshotVndbId !== current.vndbId
    const vndbData = vndbChanged && snapshotVndbId
      ? await fetchVndbGame(snapshotVndbId)
      : null

    // 先保存当前版本为新快照
    await recordEdit({
      targetType: 'GAME',
      targetId: edit.targetId,
      editorId: operatorId,
      snapshot: current as unknown as Record<string, unknown>,
      changeSummary: `撤销前的版本（操作人 #${operatorId}）`,
      isRevert: true,
    })

    // VNDB ID and its raw tag snapshot are one consistency boundary. Revert
    // them in the same transaction so a historical ID cannot retain tags
    // fetched from the newer entry.
    await prisma.$transaction(async (tx) => {
      if (vndbChanged) await lockVndbTagSyncInTransaction(tx)

      await tx.game.update({
        where: { id: edit.targetId },
        data: {
          titleEn: (snapshot.titleEn as string) ?? null,
          titleJa: (snapshot.titleJa as string) ?? null,
          titleZhHans: (snapshot.titleZhHans as string) ?? null,
          titleZhHant: (snapshot.titleZhHant as string) ?? null,
          aliases: (snapshot.aliases as string[]) ?? [],
          descriptionEn: (snapshot.descriptionEn as string) ?? null,
          descriptionJa: (snapshot.descriptionJa as string) ?? null,
          descriptionZhHans: (snapshot.descriptionZhHans as string) ?? null,
          descriptionZhHant: (snapshot.descriptionZhHant as string) ?? null,
          coverImage: (snapshot.coverImage as string) ?? null,
          releaseDate: snapshot.releaseDate ? new Date(snapshot.releaseDate as string) : null,
          isNsfw: Boolean(snapshot.isNsfw) || Boolean(vndbData?.isNsfw),
          vndbId: snapshotVndbId,
          bangumiId: (snapshot.bangumiId as number) ?? null,
          seriesId: (snapshot.seriesId as number) ?? null,
          purchaseLinks: (snapshot.purchaseLinks as object) ?? [],
          lengthMinutes: (snapshot.lengthMinutes as number) ?? null,
        },
      })

      if (vndbChanged) {
        await syncVndbTagsForGameInTransaction(tx, {
          gameId: edit.targetId,
          tags: vndbData?.tags || [],
          expectedVndbId: snapshotVndbId,
        })
        if (!snapshotVndbId) {
          await tx.game.update({
            where: { id: edit.targetId },
            data: { vndbTagsSyncedAt: null },
          })
        }
      }
    })
    await invalidateGameCaches(edit.targetId)
  } else if (edit.targetType === 'COMPANY') {
    const current = await prisma.company.findUnique({ where: { id: edit.targetId } })
    if (!current) throw createError({ statusCode: 404, message: '公司不存在' })

    await recordEdit({
      targetType: 'COMPANY',
      targetId: edit.targetId,
      editorId: operatorId,
      snapshot: current as unknown as Record<string, unknown>,
      changeSummary: `撤销前的版本（操作人 #${operatorId}）`,
      isRevert: true,
    })

    await prisma.company.update({
      where: { id: edit.targetId },
      data: {
        name: (snapshot.name as string),
        nameOriginal: (snapshot.nameOriginal as string) ?? null,
        nameIndex: (snapshot.nameIndex as string),
        aliases: (snapshot.aliases as string[]) ?? [],
        logo: (snapshot.logo as string) ?? null,
        description: (snapshot.description as string) ?? null,
        foundedYear: (snapshot.foundedYear as number) ?? null,
        website: (snapshot.website as string) ?? null,
      },
    })
  } else if (edit.targetType === 'GUIDE') {
    const current = await prisma.guide.findUnique({ where: { id: edit.targetId } })
    if (!current) throw createError({ statusCode: 404, message: '攻略不存在' })

    await recordEdit({
      targetType: 'GUIDE',
      targetId: edit.targetId,
      editorId: operatorId,
      snapshot: current as unknown as Record<string, unknown>,
      changeSummary: `撤销前的版本（操作人 #${operatorId}）`,
      isRevert: true,
    })

    await prisma.guide.update({
      where: { id: edit.targetId },
      data: {
        title: (snapshot.title as string),
        content: (snapshot.content as string),
      },
    })
  } else if (edit.targetType === 'RESOURCE') {
    const current = await prisma.resource.findUnique({ where: { id: edit.targetId } })
    if (!current) throw createError({ statusCode: 404, message: '资源不存在' })

    await recordEdit({
      targetType: 'RESOURCE',
      targetId: edit.targetId,
      editorId: operatorId,
      snapshot: current as unknown as Record<string, unknown>,
      changeSummary: `撤销前的版本（操作人 #${operatorId}）`,
      isRevert: true,
    })

    await prisma.resource.update({
      where: { id: edit.targetId },
      data: {
        title: (snapshot.title as string),
        url: (snapshot.url as string),
        extractCode: (snapshot.extractCode as string) ?? null,
        unzipPassword: (snapshot.unzipPassword as string) ?? null,
        remark: (snapshot.remark as string) ?? null,
        updatedAt: new Date(),
      },
    })
    await invalidateGameCaches(current.gameId)
  }
}

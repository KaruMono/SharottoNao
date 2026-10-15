import prisma from './prisma'
import { setSystemGameTag } from './game-tag-source'
import {
  assertTagNamesAvailableInTransaction,
  lockTagNameNamespaceInTransaction,
  prepareTagNames,
} from './tag-name'

export const MACHINE_TRANSLATION_TAG_NAME = '机器翻译'

const getStaleMachineTranslationTagWhere = (tagId: number) => ({
  tagId,
  sources: { some: { source: 'SYSTEM' as const } },
  game: {
    resources: {
      none: {
        isMachineTranslated: true,
        deletedAt: null,
        status: 'APPROVED' as const,
      },
    },
  },
})

export interface StaleMachineTranslationTagGame {
  id: number
  title: string
}

/** 获取没有有效机翻资源但仍保留机器翻译标签的游戏。 */
export async function getStaleMachineTranslationTagGames(): Promise<StaleMachineTranslationTagGame[]> {
  const tag = await prisma.tag.findUnique({
    where: { name: MACHINE_TRANSLATION_TAG_NAME },
    select: { id: true },
  })

  if (!tag) return []

  const relations = await prisma.gameTag.findMany({
    where: getStaleMachineTranslationTagWhere(tag.id),
    select: {
      game: {
        select: {
          id: true,
          titleZhHans: true,
          titleZhHant: true,
          titleJa: true,
          titleEn: true,
        },
      },
    },
    orderBy: { gameId: 'asc' },
  })

  return relations.map(({ game }) => ({
    id: game.id,
    title: game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || `游戏 #${game.id}`,
  }))
}

/**
 * 移除没有有效机翻资源却仍保留机器翻译标签的游戏标签关联。
 * 返回删除的关联数量；标签不存在时不创建标签，直接返回 0。
 */
export async function removeStaleMachineTranslationTags(): Promise<number> {
  const tag = await prisma.tag.findUnique({
    where: { name: MACHINE_TRANSLATION_TAG_NAME },
    select: { id: true },
  })

  if (!tag) return 0

  const relations = await prisma.gameTag.findMany({
    where: getStaleMachineTranslationTagWhere(tag.id),
    select: { gameId: true },
  })

  for (const relation of relations) {
    await setSystemGameTag(relation.gameId, tag.id, false)
  }

  return relations.length
}

/**
 * 自动管理游戏的机器翻译标签
 * 如果游戏有机翻资源，自动添加机器翻译标签
 * 如果游戏没有机翻资源，自动移除机器翻译标签
 */
export async function updateMachineTranslationTag(gameId: number) {
  try {
    // 检查游戏是否有机翻资源
    const hasMachineTranslatedResource = await prisma.resource.findFirst({
      where: {
        gameId,
        isMachineTranslated: true,
        deletedAt: null,
        status: 'APPROVED',
      },
    })

    // 查找或创建机翻标签。系统规范名不能与普通标签别名重名。
    const tag = await prisma.$transaction(async (tx) => {
      await lockTagNameNamespaceInTransaction(tx)
      const existing = await tx.tag.findFirst({
        where: { name: { equals: MACHINE_TRANSLATION_TAG_NAME, mode: 'insensitive' } },
      })

      if (!existing) {
        const prepared = prepareTagNames(MACHINE_TRANSLATION_TAG_NAME, [])
        await assertTagNamesAvailableInTransaction(tx, prepared)
        return tx.tag.create({
          data: {
            name: prepared.name,
            description: '包含机器翻译资源的游戏',
            isSystem: true,
          },
        })
      }

      if (!existing.isSystem || existing.archivedAt) {
        return tx.tag.update({
          where: { id: existing.id },
          data: { isSystem: true, archivedAt: null },
        })
      }

      return existing
    })

    await setSystemGameTag(gameId, tag.id, Boolean(hasMachineTranslatedResource))
  } catch (err) {
    console.error('Failed to update machine translation tag:', err)
  }
}

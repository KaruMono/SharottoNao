import prisma from './prisma'

export const MACHINE_TRANSLATION_TAG_NAME = '机器翻译'

const getStaleMachineTranslationTagWhere = (tagId: number) => ({
  tagId,
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

  const result = await prisma.gameTag.deleteMany({
    where: getStaleMachineTranslationTagWhere(tag.id),
  })

  return result.count
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

    // 查找或创建机翻标签
    let tag = await prisma.tag.findFirst({
      where: { name: MACHINE_TRANSLATION_TAG_NAME },
    })

    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          name: MACHINE_TRANSLATION_TAG_NAME,
          description: '包含机器翻译资源的游戏',
        },
      })
    }

    // 检查游戏是否已有机翻标签
    const existingGameTag = await prisma.gameTag.findUnique({
      where: {
        gameId_tagId: {
          gameId,
          tagId: tag.id,
        },
      },
    })

    if (hasMachineTranslatedResource && !existingGameTag) {
      // 有机翻资源但没有标签，添加标签
      await prisma.gameTag.create({
        data: {
          gameId,
          tagId: tag.id,
        },
      })
    } else if (!hasMachineTranslatedResource && existingGameTag) {
      // 没有机翻资源但有标签，移除标签
      await prisma.gameTag.delete({
        where: {
          gameId_tagId: {
            gameId,
            tagId: tag.id,
          },
        },
      })
    }
  } catch (err) {
    console.error('Failed to update machine translation tag:', err)
  }
}

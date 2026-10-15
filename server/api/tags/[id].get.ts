import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

// 获取显示标题
function getDisplayTitle(game: { titleEn: string | null; titleJa: string | null; titleZhHans: string | null; titleZhHant: string | null }): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || '未命名'
}

export default defineEventHandler(async (event) => {
  const idOrSlug = getRouterParam(event, 'id') as string
  const query = getQuery(event)
  const { page, limit } = querySchema.parse(query)
  
  const nsfwMode = await getUserNsfwPreference(event)
  const skip = (page - 1) * limit

  // 支持 ID 或 slug 查询
  const id = parseInt(idOrSlug)
  const tag = await prisma.tag.findFirst({
    where: {
      ...(isNaN(id) ? { slug: idOrSlug } : { id }),
      archivedAt: null,
    },
    include: {
      _count: {
        select: {
          games: {
            where: {
              game: {
                deletedAt: null,
                ...(nsfwMode === 'SFW' ? { isNsfw: false } : nsfwMode === 'NSFW' ? { isNsfw: true } : {}),
              },
            },
          },
        },
      },
    },
  })

  if (!tag) {
    throw createError({
      statusCode: 404,
      message: '标签不存在',
    })
  }

  // SFW 模式下不能查看 NSFW 标签
  if (nsfwMode === 'SFW' && tag.isNsfw) {
    throw createError({
      statusCode: 403,
      message: '该标签为 NSFW 内容，请在设置中开启 NSFW 模式',
    })
  }

  // 获取该标签下的游戏
  const nsfwFilter = nsfwMode === 'SFW' ? { isNsfw: false }
    : nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where: {
        deletedAt: null,
        tags: {
          some: { tagId: tag.id },
        },
        ...nsfwFilter,
      },
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        coverImage: true,
        releaseDate: true,
        isNsfw: true,
        companies: {
          include: {
            company: {
              select: { id: true, name: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.game.count({
      where: {
        deletedAt: null,
        tags: {
          some: { tagId: tag.id },
        },
        ...nsfwFilter,
      },
    }),
  ])

  return {
    ...tag,
    gamesCount: tag._count.games,
    games: games.map(g => ({
      id: g.id,
      title: getDisplayTitle(g),
      coverImage: g.coverImage,
      releaseDate: g.releaseDate,
      isNsfw: g.isNsfw,
      company: g.companies[0]?.company || null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

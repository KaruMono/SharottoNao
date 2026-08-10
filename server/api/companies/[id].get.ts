import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会社ID',
    })
  }

  const user = await getAuthUser(event)

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameOriginal: true,
      nameIndex: true,
      aliases: true,
      logo: true,
      description: true,
      foundedYear: true,
      website: true,
      createdAt: true,
      updatedAt: true,
      parent: {
        select: { id: true, name: true, logo: true },
      },
      children: {
        select: { id: true, name: true, logo: true },
        orderBy: { name: 'asc' },
      },
      creator: {
        select: { id: true, username: true },
      },
      _count: {
        select: {
          games: {
            where: {
              game: {
                deletedAt: null,
                ...(!user ? { isNsfw: false } : user.nsfwMode === 'SFW' ? { isNsfw: false } : user.nsfwMode === 'NSFW' ? { isNsfw: true } : {}),
              },
            },
          },
        },
      },
    },
  })

  if (!company) {
    throw createError({
      statusCode: 404,
      message: '会社不存在',
    })
  }

  // 获取该会社的游戏列表（通过多对多关系）
  const nsfwFilter = !user ? { isNsfw: false }
    : user.nsfwMode === 'SFW' ? { isNsfw: false }
    : user.nsfwMode === 'NSFW' ? { isNsfw: true }
    : {}

  const gameCompanies = await prisma.gameCompany.findMany({
    where: {
      companyId: id,
      game: { deletedAt: null, ...nsfwFilter },
    },
    include: {
      game: {
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
          coverImage: true,
          releaseDate: true,
          isNsfw: true,
        },
      },
    },
    orderBy: { game: { releaseDate: 'desc' } },
    take: 20,
  })

  // 为每个游戏添加显示标题和角色
  const gamesWithTitle = gameCompanies.map(gc => ({
    ...gc.game,
    title: gc.game.titleZhHans || gc.game.titleJa || gc.game.titleEn || gc.game.titleZhHant || '未命名',
    companyRole: gc.role,
  }))

  // 计算游戏总数
  const gamesCount = company._count.games

  return {
    ...company,
    gamesCount,
    games: gamesWithTitle,
  }
})

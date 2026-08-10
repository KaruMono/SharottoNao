import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getDisplayTitle } from '~/server/utils/game'
import { buildNsfwFilterFromUser } from '~/server/utils/nsfw'
import { resolveAvatar } from '~/server/utils/gravatar'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' })
  }

  const currentUser = await getAuthUser(event)
  const nsfwFilter = buildNsfwFilterFromUser(currentUser)

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      role: true,
      title: true,
      titleColor: true,
      createdAt: true,
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          favorites: { where: { game: { deletedAt: null } } },
          createdGames: { where: { deletedAt: null } },
          contentEdits: true,
          resources: { where: { deletedAt: null } },
          guides: { where: { game: { deletedAt: null } } },
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // 获取用户最近的评论
  const recentComments = await prisma.comment.findMany({
    where: {
      userId: id,
      deletedAt: null,
      game: nsfwFilter,
    },
    include: {
      game: {
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // 获取用户收藏的游戏
  const recentFavorites = await prisma.favorite.findMany({
    where: {
      userId: id,
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
          isNsfw: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // 获取用户创建的游戏条目
  const createdGames = await prisma.game.findMany({
    where: {
      creatorId: id,
      deletedAt: null,
      ...nsfwFilter,
    },
    select: {
      id: true,
      titleEn: true,
      titleJa: true,
      titleZhHans: true,
      titleZhHant: true,
      coverImage: true,
      isNsfw: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const { email: _email, ...userPublic } = user

  return {
    user: {
      ...userPublic,
      avatar: await resolveAvatar(user.avatar, user.email),
    },
    recentComments: recentComments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      game: {
        id: c.game.id,
        title: getDisplayTitle(c.game),
      },
    })),
    recentFavorites: recentFavorites.map(f => ({
      ...f.game,
      title: getDisplayTitle(f.game),
    })),
    createdGames: createdGames.map(g => ({
      ...g,
      title: getDisplayTitle(g),
    })),
  }
})

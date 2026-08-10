import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { resolveAvatar } from '~/server/utils/gravatar'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // 并行获取所有统计数据（编辑/创建数来自 Activity，与排行榜数据源保持一致）
  const [createdGamesCount, editedGamesCount, favoritesCount, commentsCount, followersCount, followingCount] = await Promise.all([
    prisma.activity.count({
      where: { userId: user.id, type: 'CREATE_GAME' },
    }),
    prisma.activity.count({
      where: { userId: user.id, type: 'EDIT_GAME' },
    }),
    prisma.favorite.count({
      where: { userId: user.id, game: { deletedAt: null } },
    }),
    prisma.comment.count({
      where: { userId: user.id, deletedAt: null },
    }),
    prisma.userFollow.count({
      where: { followingId: user.id },
    }),
    prisma.userFollow.count({
      where: { followerId: user.id },
    }),
  ])

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: await resolveAvatar(user.avatar, user.email),
    bio: user.bio,
    role: user.role,
    nsfwMode: user.nsfwMode,
    emailNotify: user.emailNotify,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    stats: {
      createdGames: createdGamesCount,
      editedGames: editedGamesCount,
      favorites: favoritesCount,
      comments: commentsCount,
      followers: followersCount,
      following: followingCount,
    },
  }
})

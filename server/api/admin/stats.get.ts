import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const ACTIVITY_TYPES = ['CREATE_GAME', 'EDIT_GAME', 'COMMENT', 'CREATE_GUIDE', 'EDIT_GUIDE', 'RATE_GAME', 'FAVORITE_GAME']

async function getValidActivityIds() {
  const [games, comments, guides] = await Promise.all([
    prisma.game.findMany({ where: { deletedAt: null }, select: { id: true } }),
    prisma.comment.findMany({ where: { deletedAt: null, game: { deletedAt: null } }, select: { id: true } }),
    prisma.guide.findMany({ where: { game: { deletedAt: null } }, select: { id: true } }),
  ])

  return {
    gameIds: new Set(games.map(item => item.id)),
    commentIds: new Set(comments.map(item => item.id)),
    guideIds: new Set(guides.map(item => item.id)),
  }
}

function getActivityMetaId(meta: unknown, key: string) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const value = (meta as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : null
}

function isActivityStillValid(
  activity: { type: string; targetType: string | null; targetId: number | null; meta: unknown },
  validIds: { gameIds: Set<number>; commentIds: Set<number>; guideIds: Set<number> },
) {
  if (!activity.targetId) return false
  if (['CREATE_GAME', 'EDIT_GAME', 'RATE_GAME', 'FAVORITE_GAME'].includes(activity.type)) {
    return activity.targetType === 'game' && validIds.gameIds.has(activity.targetId)
  }
  if (activity.type === 'COMMENT') {
    const commentId = getActivityMetaId(activity.meta, 'commentId')
    return activity.targetType === 'game'
      ? validIds.gameIds.has(activity.targetId) && (!commentId || validIds.commentIds.has(commentId))
      : validIds.commentIds.has(activity.targetId)
  }
  if (['CREATE_GUIDE', 'EDIT_GUIDE'].includes(activity.type)) {
    return activity.targetType === 'guide' && validIds.guideIds.has(activity.targetId)
  }
  return false
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // 注册统计时间范围
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400_000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalGames,
    totalUsers,
    totalCompanies,
    totalTags,
    totalImages,
    unusedImages,
    todayUsers,
    yesterdayUsers,
    monthUsers,
    todayDownloads,
    todayLogins,
    recentUsers,
    recentGames,
    recentActivities,
  ] = await Promise.all([
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.user.count(),
    prisma.company.count(),
    prisma.tag.count(),
    prisma.image.count(),
    prisma.image.count({ where: { isUsed: false } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.downloadRecord.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: todayStart } } }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.game.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        titleEn: true,
        titleJa: true,
        titleZhHans: true,
        titleZhHant: true,
        isNsfw: true,
        createdAt: true,
        creator: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // 最近7天各类活动
    prisma.activity.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        type: { in: ACTIVITY_TYPES as any },
      },
      select: {
        type: true,
        targetType: true,
        targetId: true,
        meta: true,
      },
    }),
  ])

  // 整理活动统计
  const validActivityIds = await getValidActivityIds()
  const activityStats = recentActivities.reduce((acc, activity) => {
    if (!isActivityStillValid(activity, validActivityIds)) return acc
    acc[activity.type] = (acc[activity.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    stats: {
      totalGames,
      totalUsers,
      totalCompanies,
      totalTags,
      totalImages,
      unusedImages,
      todayUsers,
      yesterdayUsers,
      monthUsers,
      todayDownloads,
      todayLogins,
    },
    recentActivityStats: {
      period: '最近7天',
      createdGames: activityStats.CREATE_GAME || 0,
      editedGames: activityStats.EDIT_GAME || 0,
      comments: activityStats.COMMENT || 0,
      guides: (activityStats.CREATE_GUIDE || 0) + (activityStats.EDIT_GUIDE || 0),
      ratings: activityStats.RATE_GAME || 0,
      favorites: activityStats.FAVORITE_GAME || 0,
    },
    recentUsers,
    recentGames,
  }
})

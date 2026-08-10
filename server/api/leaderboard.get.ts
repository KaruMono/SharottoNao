import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { cachedFetch, CacheTTL } from '~/server/utils/redis'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['all', 'edit', 'resource', 'guide']).default('all'),
})

// 贡献权重（与 Activity.type 对应）
const WEIGHTS: Record<string, number> = {
  CREATE_GAME: 5,
  EDIT_GAME: 3,
  CREATE_GUIDE: 3,
  EDIT_GUIDE: 2,
  COMMENT: 1,
  RATE_GAME: 1,
  FAVORITE_GAME: 0, // 收藏不计入贡献
}

// 根据类型获取要统计的活动类型
function getActivityTypes(type: 'all' | 'edit' | 'resource' | 'guide'): string[] {
  switch (type) {
    case 'edit':
      return ['CREATE_GAME', 'EDIT_GAME']
    case 'resource':
      // 资源榜使用单独的统计方法
      return []
    case 'guide':
      return ['CREATE_GUIDE', 'EDIT_GUIDE']
    case 'all':
    default:
      return Object.keys(WEIGHTS).filter(k => WEIGHTS[k] > 0)
  }
}

// 获取资源榜数据
async function getResourceLeaderboard() {
  const resourceCounts = await prisma.resource.groupBy({
    by: ['uploaderId'],
    where: {
      deletedAt: null,
      status: 'APPROVED',
      game: { deletedAt: null },
    },
    _count: { id: true },
  })

  const scoreMap = new Map<number, { score: number; breakdown: Record<string, number> }>()

  for (const row of resourceCounts) {
    const count = row._count.id
    scoreMap.set(row.uploaderId, {
      score: count,
      breakdown: { resources: count },
    })
  }

  return scoreMap
}

// 获取仍然有效的活动范围（仅校验活动中实际出现的 id，避免全表拉取）
async function getValidActivityIds(
  activityTypes: string[],
  candidateIds: { gameIds: number[]; commentIds: number[]; guideIds: number[] },
) {
  const validGames = activityTypes.some(type => ['CREATE_GAME', 'EDIT_GAME', 'RATE_GAME', 'COMMENT'].includes(type)) && candidateIds.gameIds.length > 0
    ? await prisma.game.findMany({
        where: { id: { in: candidateIds.gameIds }, deletedAt: null },
        select: { id: true },
      })
    : []

  const validComments = activityTypes.includes('COMMENT') && candidateIds.commentIds.length > 0
    ? await prisma.comment.findMany({
        where: { id: { in: candidateIds.commentIds }, deletedAt: null, game: { deletedAt: null } },
        select: { id: true },
      })
    : []

  const validGuides = activityTypes.some(type => ['CREATE_GUIDE', 'EDIT_GUIDE'].includes(type)) && candidateIds.guideIds.length > 0
    ? await prisma.guide.findMany({
        where: { id: { in: candidateIds.guideIds }, game: { deletedAt: null } },
        select: { id: true },
      })
    : []

  return {
    gameIds: new Set(validGames.map(item => item.id)),
    commentIds: new Set(validComments.map(item => item.id)),
    guideIds: new Set(validGuides.map(item => item.id)),
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
  if (['CREATE_GAME', 'EDIT_GAME', 'RATE_GAME'].includes(activity.type)) {
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

function getDateFrom(period: 'all' | 'month' | 'week'): Date | null {
  if (period === 'all') return null
  const now = new Date()
  const days = period === 'week' ? 7 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { page, limit, type } = querySchema.parse(query)

  const cacheKey = `leaderboard:${type}:${page}:${limit}`

  return cachedFetch(cacheKey, async () => {
    let scoreMap: Map<number, { score: number; breakdown: Record<string, number> }>

    if (type === 'resource') {
      // 资源榜：直接统计用户上传的资源数量
      scoreMap = await getResourceLeaderboard()
    } else {
      // 其他榜单：基于活动记录统计
      const activityTypes = getActivityTypes(type)

      const activities = await prisma.activity.findMany({
        where: {
          type: { in: activityTypes as any },
        },
        select: {
          userId: true,
          type: true,
          targetType: true,
          targetId: true,
          meta: true,
        },
      })

      // 收集活动中实际出现的目标 id，用于存在性校验
      const candidateGameIds = new Set<number>()
      const candidateCommentIds = new Set<number>()
      const candidateGuideIds = new Set<number>()
      for (const activity of activities) {
        if (!activity.targetId) continue
        if (['CREATE_GAME', 'EDIT_GAME', 'RATE_GAME'].includes(activity.type)) {
          if (activity.targetType === 'game') candidateGameIds.add(activity.targetId)
        } else if (activity.type === 'COMMENT') {
          if (activity.targetType === 'game') {
            candidateGameIds.add(activity.targetId)
            const commentId = getActivityMetaId(activity.meta, 'commentId')
            if (commentId) candidateCommentIds.add(commentId)
          } else {
            candidateCommentIds.add(activity.targetId)
          }
        } else if (['CREATE_GUIDE', 'EDIT_GUIDE'].includes(activity.type)) {
          if (activity.targetType === 'guide') candidateGuideIds.add(activity.targetId)
        }
      }

      // 校验仍然有效的 Activity，避免已删除游戏/评论/攻略继续贡献排行榜
      const validIds = await getValidActivityIds(activityTypes, {
        gameIds: [...candidateGameIds],
        commentIds: [...candidateCommentIds],
        guideIds: [...candidateGuideIds],
      })
      const grouped = new Map<string, { userId: number; type: string; count: number }>()
      for (const activity of activities) {
        if (!isActivityStillValid(activity, validIds)) continue
        const key = `${activity.userId}:${activity.type}`
        const current = grouped.get(key)
        if (current) current.count += 1
        else grouped.set(key, { userId: activity.userId, type: activity.type, count: 1 })
      }

      // 计算每个用户的加权得分和明细
      scoreMap = new Map<number, { score: number; breakdown: Record<string, number> }>()

      for (const row of grouped.values()) {
        const weight = WEIGHTS[row.type] ?? 0
        const count = row.count
        if (!scoreMap.has(row.userId)) {
          scoreMap.set(row.userId, { score: 0, breakdown: {} })
        }
        const entry = scoreMap.get(row.userId)!
        entry.score += count * weight
        entry.breakdown[row.type] = (entry.breakdown[row.type] || 0) + count
      }
    }

    if (scoreMap.size === 0) {
      return { items: [], pagination: { page, total: 0, totalPages: 0 } }
    }

    // 按得分排序
    const sortedUserIds = [...scoreMap.entries()]
      .filter(([, v]) => v.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id]) => id)

    const total = sortedUserIds.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const pageUserIds = sortedUserIds.slice(start, start + limit)

    // 批量获取用户信息
    const users = await prisma.user.findMany({
      where: { id: { in: pageUserIds }, status: 'ACTIVE' },
      select: { id: true, username: true, avatar: true },
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    // 组装结果，保持排序顺序
    const items = pageUserIds
      .filter(id => userMap.has(id))
      .map((id, index) => {
        const { score, breakdown } = scoreMap.get(id)!
        const user = userMap.get(id)!
        // 将 Activity type 或资源统计映射为前端友好的 breakdown 键名
        const friendlyBreakdown: any = {}
        
        if (breakdown.resources !== undefined) {
          // 资源榜
          friendlyBreakdown.resources = breakdown.resources
        } else {
          // 其他榜单
          friendlyBreakdown.createdGames = breakdown.CREATE_GAME || 0
          friendlyBreakdown.editedGames = breakdown.EDIT_GAME || 0
          friendlyBreakdown.guides = (breakdown.CREATE_GUIDE || 0) + (breakdown.EDIT_GUIDE || 0)
          friendlyBreakdown.comments = breakdown.COMMENT || 0
          friendlyBreakdown.ratings = breakdown.RATE_GAME || 0
        }
        
        return {
          rank: start + index + 1,
          user,
          score,
          breakdown: friendlyBreakdown,
        }
      })

    return {
      items,
      pagination: { page, total, totalPages },
    }
  }, CacheTTL.MEDIUM)
})

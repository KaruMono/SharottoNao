import prisma from '~/server/utils/prisma'
import { getAuthUser } from '~/server/utils/auth'
import { getDisplayTitle, getDisplayDescription } from '~/server/utils/game'
import { buildNsfwFilterFromUser, resolveNsfwMode } from '~/server/utils/nsfw'
import { incrementViewCount } from '~/server/utils/view-counter'
import { parseEmojis } from '~/server/utils/emoji'
import { isEffectivelyEmptyHtml } from '~/server/utils/html'
import { buildGameTagVisibilityWhere } from '~/server/utils/tag-visibility'
import { resolveGameTagDisplayTier } from '~/utils/tag-display-tier'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  const user = await getAuthUser(event)
  const nsfwMode = resolveNsfwMode(user)

  const game = await prisma.game.findUnique({
    where: { id, deletedAt: null },
    include: {
      series: {
        select: { id: true, name: true, nameOriginal: true },
      },
      companies: {
        include: {
          company: {
            select: { id: true, name: true, nameOriginal: true },
          },
        },
      },
      creator: {
        select: { id: true, username: true, avatar: true },
      },
      tags: {
        where: buildGameTagVisibilityWhere(nsfwMode),
        include: {
          tag: true,
          sources: { select: { source: true, displayTier: true } },
        },
      },
      staff: {
        include: {
          staff: true,
        },
      },
      screenshots: {
        orderBy: { sortOrder: 'asc' },
      },
      comments: {
        where: { parentId: null, deletedAt: null }, // 只获取顶级评论（排除软删除）
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
          replies: {
            where: { deletedAt: null },
            include: {
              user: {
                select: { id: true, username: true, avatar: true },
              },
              _count: {
                select: { likes: true },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
          _count: {
            select: { likes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: {
        select: { ratings: true, comments: true, favorites: true },
      },
    },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  // NSFW权限检查
  if (game.isNsfw) {
    if (!user) {
      throw createError({
        statusCode: 403,
        message: '请登录后查看此内容',
      })
    }
    if (user.nsfwMode === 'SFW') {
      throw createError({
        statusCode: 403,
        message: '当前NSFW模式不允许查看此内容',
      })
    }
  }

  // 构建 NSFW 过滤条件
  const nsfwFilter = buildNsfwFilterFromUser(user)

  // 获取今日日期（只保留日期部分，用于 bumpDate 查询）
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 并行执行所有额外查询
  const [
    avgRating,
    favorite,
    rating,
    resources,
    relatedGames,
    seriesGames,
    todayBumps,
    hasBumpedToday,
    avgPlayTime,
    guidesCount,
    activeCommentCount,
    userLikedComments,
  ] = await Promise.all([
    // 计算平均评分
    prisma.rating.aggregate({
      where: { gameId: id },
      _avg: { score: true },
    }),
    // 检查当前用户是否收藏
    user ? prisma.favorite.findUnique({
      where: {
        gameId_userId: { gameId: id, userId: user.id },
      },
    }) : null,
    // 获取用户评分
    user ? prisma.rating.findUnique({
      where: {
        gameId_userId: { gameId: id, userId: user.id },
      },
    }) : null,
    // 获取资源元信息；未授权用户的实际下载地址会在响应整理阶段移除
    prisma.resource.findMany({
      where: {
        gameId: id,
        deletedAt: null,
        ...(!user || (user.role !== 'ADMIN') ? {
          OR: [
            { status: 'APPROVED' },
            ...(user ? [{ uploaderId: user.id }] : []), // 登录用户可以看到自己上传的待审核资源
          ],
        } : {}),
      },
      include: {
        type: true,
        netDiskType: true,
        uploader: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // 获取相关推荐（同会社相近年代的作品）
    game.companies.length > 0 ? (async () => {
      // 获取当前游戏的发售年份
      const releaseYear = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null
      
      return prisma.game.findMany({
        where: {
          companies: {
            some: {
              companyId: { in: game.companies.map(c => c.companyId) },
            },
          },
          id: { not: id },
          deletedAt: null,
          ...nsfwFilter,
          // 如果有发售日期，筛选相近年代（前后3年）
          ...(releaseYear && {
            releaseDate: {
              gte: new Date(`${releaseYear - 3}-01-01`),
              lte: new Date(`${releaseYear + 3}-12-31`),
            },
          }),
        },
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
          coverImage: true,
          releaseDate: true,
          companies: {
            include: {
              company: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: releaseYear ? { releaseDate: 'desc' } : { createdAt: 'desc' },
        take: 3,
      })
    })() : [],
    // 同系列游戏：按 id 稳定排序后随机 offset，最多取 3 条（避免拉全表再在内存 shuffle）
    game.seriesId ? (async () => {
      const seriesWhere = {
        seriesId: game.seriesId,
        id: { not: id },
        deletedAt: null,
        ...nsfwFilter,
      }
      const count = await prisma.game.count({ where: seriesWhere })
      if (count === 0) return []
      const maxOffset = Math.max(0, count - 3)
      const skip = maxOffset === 0 ? 0 : Math.floor(Math.random() * (maxOffset + 1))
      return prisma.game.findMany({
        where: seriesWhere,
        select: {
          id: true,
          titleEn: true,
          titleJa: true,
          titleZhHans: true,
          titleZhHant: true,
          coverImage: true,
          releaseDate: true,
        },
        orderBy: { id: 'asc' },
        skip,
        take: 3,
      })
    })() : [],
    // 今日顶数（使用 bumpDate 日期字段）
    prisma.gameBump.count({
      where: {
        gameId: id,
        bumpDate: today,
      },
    }),
    // 用户今天是否已顶
    user ? prisma.gameBump.findFirst({
      where: {
        gameId: id,
        userId: user.id,
        bumpDate: today,
      },
    }) : null,
    // 用户评论的平均游玩时长
    prisma.comment.aggregate({
      where: {
        gameId: id,
        deletedAt: null,
        playTime: { not: null },
      },
      _avg: { playTime: true },
    }),
    // 攻略数量
    prisma.guide.count({
      where: { gameId: id },
    }),
    // 有效评论数量
    prisma.comment.count({
      where: {
        gameId: id,
        parentId: null,
        deletedAt: null,
      },
    }),
    // 用户点赞的评论ID列表
    user ? prisma.commentLike.findMany({
      where: {
        userId: user.id,
        comment: { gameId: id },
      },
      select: { commentId: true },
    }) : [],
  ])

  // 增加浏览量（异步，不阻塞响应）
  incrementViewCount(id)

  const isFavorited = !!favorite
  const favoriteStatus = (favorite as any)?.status ?? null
  const userRating = rating?.score ?? null
  const likedCommentIds = new Set(userLikedComments.map(l => l.commentId))

  // 为评论添加点赞状态和点赞数，并解析表情
  // 同时过滤历史遗留的“空壳评论”（内容实质为空，只会渲染出头像和用户名）
  const commentsWithLikeStatus = (await Promise.all(game.comments.map(async comment => {
    const replies = (await Promise.all((comment.replies || []).map(async reply => ({
      ...reply,
      content: await parseEmojis(reply.content),
      isLiked: likedCommentIds.has(reply.id),
      likeCount: (reply as any)._count?.likes || 0,
    })))).filter(reply => !isEffectivelyEmptyHtml(reply.content))

    const content = await parseEmojis(comment.content)

    // 空内容且没有有效回复的顶级评论直接丢弃；若仍有回复则保留以维持回复上下文
    if (isEffectivelyEmptyHtml(content) && replies.length === 0) {
      return null
    }

    return {
      ...comment,
      content,
      isLiked: likedCommentIds.has(comment.id),
      likeCount: (comment as any)._count?.likes || 0,
      replies,
    }
  }))).filter((c): c is NonNullable<typeof c> => c !== null)

  const sortedResources = [...resources].sort((a: any, b: any) => {
    const aSort = a.netDiskType?.sortOrder ?? 9999
    const bSort = b.netDiskType?.sortOrder ?? 9999
    if (aSort !== bSort) return aSort - bSort
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    ...game,
    // 添加显示标题和简介
    title: getDisplayTitle(game),
    description: getDisplayDescription(game),
    // 转换会社数据（包含角色信息）
    companies: game.companies.map(gc => ({
      companyId: gc.companyId,
      role: gc.role,
      company: {
        id: gc.company.id,
        name: gc.company.name,
        nameOriginal: gc.company.nameOriginal,
      },
      // 兼容直接访问
      id: gc.company.id,
      name: gc.company.name,
    })),
    // 兼容旧的单一 company 字段
    company: game.companies[0]?.company || null,
    tags: game.tags.map(t => ({
      ...t.tag,
      sources: t.sources.map(source => source.source),
      displayTier: resolveGameTagDisplayTier(t.sources),
    })),
    staff: game.staff.map(s => ({
      ...s.staff,
      role: s.role,
    })),
    comments: commentsWithLikeStatus,
    avgRating: avgRating._avg.score ? Number(avgRating._avg.score.toFixed(1)) : null,
    ratingCount: game._count.ratings,
    commentCount: activeCommentCount,
    favoriteCount: game._count.favorites,
    isFavorited,
    favoriteStatus,
    userRating,
    // 下载地址仍只对管理员和上传者保留；登录用户可以在游戏页看到提取码和解压密码。
    resources: sortedResources.map((r: any) => {
      if (user?.role === 'ADMIN' || r.uploaderId === user?.id) {
        return r
      }
      if (user) {
        const { url, ...authenticatedResource } = r
        return authenticatedResource
      }
      // 访客只需要可索引的资源摘要；下载地址、提取码和解压密码
      // 仍然必须通过下载页的鉴权流程获取。
      const {
        url,
        extractCode,
        unzipPassword,
        healthStatus,
        healthNote,
        healthCheckedAt,
        issueCount,
        ...safeResource
      } = r
      return safeResource
    }),
    relatedGames: relatedGames.map(g => ({
      ...g,
      title: getDisplayTitle(g),
      company: g.companies[0]?.company || null,
    })),
    // 同系列游戏
    seriesGames: seriesGames.map(g => ({
      ...g,
      title: getDisplayTitle(g),
    })),
    // 顶一下数据
    todayBumps,
    hasBumpedToday: !!hasBumpedToday,
    // 游戏时间
    avgPlayTime: avgPlayTime._avg.playTime,
    guidesCount,
  }
})

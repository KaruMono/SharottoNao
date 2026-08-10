import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const FAVORITE_STATUSES = ['WISHLIST', 'PLAYING', 'COMPLETED', 'ON_HOLD', 'DROPPED'] as const
const LEGACY_STATUS_MAP = {
  NOT_PLAYED: 'WISHLIST',
  PLAYED: 'COMPLETED',
} as const

function normalizeStatus(status?: string) {
  if (!status) return undefined
  if ((FAVORITE_STATUSES as readonly string[]).includes(status)) return status
  return LEGACY_STATUS_MAP[status as keyof typeof LEGACY_STATUS_MAP]
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.string().optional().transform(normalizeStatus).pipe(z.enum(FAVORITE_STATUSES).optional()),
})

// 获取显示标题
function getDisplayTitle(game: { titleEn: string | null; titleJa: string | null; titleZhHans: string | null; titleZhHant: string | null }): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || '未命名'
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const { page, limit, status } = querySchema.parse(query)

  const skip = (page - 1) * limit

  // 根据用户NSFW模式筛选
  const nsfwFilter = user.nsfwMode === 'SFW' 
    ? { isNsfw: false }
    : user.nsfwMode === 'NSFW'
    ? { isNsfw: true }
    : {}

  const statusFilter = status ? { status } : {}

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where: {
        userId: user.id,
        game: { deletedAt: null, ...nsfwFilter },
        ...statusFilter,
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
            companies: {
              include: {
                company: {
                  select: { id: true, name: true },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.favorite.count({
      where: {
        userId: user.id,
        game: { deletedAt: null, ...nsfwFilter },
        ...statusFilter,
      },
    }),
  ])

  // 兼容两种格式：直接数组和分页对象
  const items = favorites.map(f => ({
    id: f.id,
    status: f.status,
    note: f.note,
    startedAt: f.startedAt,
    completedAt: f.completedAt,
    statusUpdatedAt: f.statusUpdatedAt,
    createdAt: f.createdAt,
    game: {
      id: f.game.id,
      title: getDisplayTitle(f.game),
      coverImage: f.game.coverImage,
      releaseDate: f.game.releaseDate,
      isNsfw: f.game.isNsfw,
      company: f.game.companies[0]?.company || null,
    },
  }))

  // 如果没有分页参数，直接返回数组（兼容profile页面）
  const queryRaw = getQuery(event)
  if (!queryRaw.page) {
    return items
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

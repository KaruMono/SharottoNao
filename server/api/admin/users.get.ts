import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['USER', 'EDITOR', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'BANNED']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  
  const query = getQuery(event)
  const { page, limit, search, role, status } = querySchema.parse(query)
  
  const skip = (page - 1) * limit

  const searchFilter = search ? {
    OR: [
      { username: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ],
  } : {}

  const whereClause = {
    ...searchFilter,
    ...(role && { role }),
    ...(status && { status }),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        registrationIp: true,
        loginIps: true,
        unlimitedDownload: true,
        createdAt: true,
        _count: {
          select: {
            createdGames: { where: { deletedAt: null } },
            comments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: whereClause }),
  ])

  return {
    items: users.map(u => ({
      ...u,
      createdGamesCount: u._count.createdGames,
      commentsCount: u._count.comments,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

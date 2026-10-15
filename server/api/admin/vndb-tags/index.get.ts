import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'MAPPED', 'IGNORED']).optional(),
  displayTier: z.enum(['PRIMARY', 'SECONDARY']).optional(),
  isNsfw: z.enum(['true', 'false']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const { page, limit, search, status, displayTier, isNsfw } = querySchema.parse(getQuery(event))

  const where = {
    ...(status && { status }),
    ...(displayTier && { displayTier }),
    ...(isNsfw !== undefined && { isNsfw: isNsfw === 'true' }),
    ...(search && {
      OR: [
        { id: { contains: search, mode: 'insensitive' as const } },
        { nameEn: { contains: search, mode: 'insensitive' as const } },
        { tag: { name: { contains: search, mode: 'insensitive' as const } } },
        { tag: { aliases: { some: { name: { contains: search, mode: 'insensitive' as const } } } } },
      ],
    }),
  }

  const [items, total, pending, mapped, ignored] = await Promise.all([
    prisma.vndbTag.findMany({
      where,
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            isNsfw: true,
            archivedAt: true,
          },
        },
        _count: { select: { games: true } },
      },
      orderBy: [{ status: 'asc' }, { games: { _count: 'desc' } }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vndbTag.count({ where }),
    prisma.vndbTag.count({ where: { status: 'PENDING' } }),
    prisma.vndbTag.count({ where: { status: 'MAPPED' } }),
    prisma.vndbTag.count({ where: { status: 'IGNORED' } }),
  ])

  return {
    items: items.map(item => ({
      ...item,
      gamesCount: item._count.games,
      _count: undefined,
    })),
    stats: { pending, mapped, ignored, total: pending + mapped + ignored },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  unused: z.enum(['true', 'false']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const query = getQuery(event)
  const { page, limit, unused } = querySchema.parse(query)
  
  const skip = (page - 1) * limit

  const whereClause = unused !== undefined
    ? { isUsed: unused !== 'true' }
    : {}

  const [images, total] = await Promise.all([
    prisma.image.findMany({
      where: whereClause,
      include: {
        game: {
          select: { id: true, titleEn: true, titleJa: true, titleZhHans: true, titleZhHant: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.image.count({ where: whereClause }),
  ])

  return {
    items: images,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})

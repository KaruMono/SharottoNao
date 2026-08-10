import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const query = getQuery(event)
  const { page, limit, status } = querySchema.parse(query)
  
  const where: any = {
    deletedAt: null,
  }
  
  if (status) {
    where.status = status
  }
  
  const [resources, total, pendingCount] = await Promise.all([
    prisma.resource.findMany({
      where,
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
        type: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
        netDiskType: true,
        uploader: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // PENDING 排在前面
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.resource.count({ where }),
    prisma.resource.count({ where: { deletedAt: null, status: 'PENDING' } }),
  ])
  
  return {
    resources,
    total,
    totalPages: Math.ceil(total / limit),
    pendingCount,
  }
})

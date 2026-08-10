import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  type: z.enum(['COMMENT', 'RESOURCE', 'GUIDE']).optional(),
  status: z.enum(['PENDING', 'RESOLVED', 'REJECTED']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const query = getQuery(event)
  const { page, limit, type, status } = querySchema.parse(query)
  const skip = (page - 1) * limit

  const where: any = {}
  if (type) where.type = type
  if (status) where.status = status

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: {
          select: { id: true, username: true, avatar: true },
        },
        handledBy: {
          select: { id: true, username: true },
        },
        comment: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        resource: {
          include: {
            uploader: {
              select: { id: true, username: true },
            },
          },
        },
        guide: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where }),
  ])

  return {
    reports,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  }
})

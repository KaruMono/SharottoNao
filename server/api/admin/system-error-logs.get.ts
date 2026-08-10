import { z } from 'zod'
import type { SystemErrorLog } from '@prisma/client'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { isMissingSystemErrorLogTable } from '~/server/utils/system-error-log'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.string().trim().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const { page, limit, type } = querySchema.parse(query)
  const skip = (page - 1) * limit
  const where = {
    ...(type && { type }),
  }

  let items: SystemErrorLog[] = []
  let total = 0

  try {
    ;[items, total] = await Promise.all([
      prisma.systemErrorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemErrorLog.count({ where }),
    ])
  } catch (error) {
    if (!isMissingSystemErrorLogTable(error)) throw error
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

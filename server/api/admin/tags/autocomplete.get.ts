import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const querySchema = z.object({
  search: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(30).default(15),
  includeSystem: z.enum(['true', 'false']).default('false'),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const { search, limit, includeSystem } = querySchema.parse(getQuery(event))

  return prisma.tag.findMany({
    where: {
      archivedAt: null,
      ...(includeSystem === 'false' && { isSystem: false }),
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { aliases: { some: { name: { contains: search, mode: 'insensitive' } } } },
        { vndbTags: { some: { id: { contains: search, mode: 'insensitive' } } } },
        { vndbTags: { some: { nameEn: { contains: search, mode: 'insensitive' } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      isNsfw: true,
      isSystem: true,
      vndbTags: {
        select: { id: true, nameEn: true },
        orderBy: { id: 'asc' },
        take: 3,
      },
    },
    orderBy: [{ games: { _count: 'desc' } }, { name: 'asc' }],
    take: limit,
  })
})

import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getUserNsfwPreference } from '~/server/utils/nsfw'

const querySchema = z.object({
  search: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export default defineEventHandler(async (event) => {
  const { search, limit } = querySchema.parse(getQuery(event))
  const nsfwMode = await getUserNsfwPreference(event)

  return prisma.tag.findMany({
    where: {
      archivedAt: null,
      isSystem: false,
      ...(nsfwMode === 'SFW' && { isNsfw: false }),
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

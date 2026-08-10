import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'
import { z } from 'zod'

// 获取显示标题
function getDisplayTitle(game: any): string {
  return game.titleZhHans || game.titleZhHant || game.titleJa || game.titleEn || ''
}

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const query = getQuery(event)
  const { page, limit, status } = querySchema.parse(query)

  const where: any = {}
  if (status) where.status = status

  const [requests, total, pendingCount] = await Promise.all([
    prisma.gameEditRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true },
        },
        game: {
          select: {
            id: true,
            titleEn: true,
            titleJa: true,
            titleZhHans: true,
            titleZhHant: true,
          },
        },
        reviewedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gameEditRequest.count({ where }),
    prisma.gameEditRequest.count({ where: { status: 'PENDING' } }),
  ])

  // 收集本页所有请求 changes.tagIds 里出现的 tagId，批量查一次，
  // 让前端能显示标签名而不是裸 id
  const allTagIds = new Set<number>()
  for (const r of requests) {
    const changes = r.changes as Record<string, { old: any; new: any }> | null
    if (!changes) continue
    for (const arr of [changes.tagIds?.old, changes.tagIds?.new]) {
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'number') allTagIds.add(id)
        }
      }
    }
  }

  const tagRows = allTagIds.size > 0
    ? await prisma.tag.findMany({
        where: { id: { in: [...allTagIds] } },
        select: { id: true, name: true, color: true, isNsfw: true },
      })
    : []

  const tagMap: Record<number, { name: string; color: string | null; isNsfw: boolean }> = {}
  for (const t of tagRows) tagMap[t.id] = { name: t.name, color: t.color, isNsfw: t.isNsfw }

  return {
    requests: requests.map(r => ({
      ...r,
      game: r.game ? { ...r.game, title: getDisplayTitle(r.game) } : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    pendingCount,
    tagMap,
  }
})

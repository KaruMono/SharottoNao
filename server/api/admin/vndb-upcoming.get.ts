import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import { fetchVndbUpcomingReleaseCandidates } from '~/server/utils/vndb-upcoming-release'

const querySchema = z.object({
  days: z.coerce.number().min(1).max(30).optional().default(14),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = querySchema.parse(getQuery(event))

  try {
    return await fetchVndbUpcomingReleaseCandidates(query.days)
  } catch (error: any) {
    console.error('[VNDB Upcoming Release] Fetch failed:', error)
    throw createError({
      statusCode: 502,
      message: error?.message || '获取 VNDB 近期发售列表失败',
    })
  }
})

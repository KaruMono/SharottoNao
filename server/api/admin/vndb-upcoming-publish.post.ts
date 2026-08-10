import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import { publishVndbUpcomingReleases } from '~/server/utils/vndb-upcoming-release'

const schema = z.object({
  vndbIds: z.array(z.string().regex(/^v\d+$/)).min(1).max(20),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)

  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '数据验证失败: ' + JSON.stringify(e.errors?.slice(0, 3)),
    })
  }

  return publishVndbUpcomingReleases(data.vndbIds, admin.id)
})

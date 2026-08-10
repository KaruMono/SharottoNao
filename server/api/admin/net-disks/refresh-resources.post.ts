import { requireAdmin } from '~/server/utils/auth'
import { invalidateCache } from '~/server/utils/redis'
import { refreshResourceNetDiskTypes } from '~/server/utils/net-disk'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const result = await refreshResourceNetDiskTypes()
  invalidateCache('game:*').catch(() => {})

  return {
    success: true,
    ...result,
  }
})

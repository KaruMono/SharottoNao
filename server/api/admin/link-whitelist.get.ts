import { requireAdmin } from '~/server/utils/auth'
import { getWhitelistedDomains } from '~/server/utils/link-filter'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getWhitelistedDomains()
})

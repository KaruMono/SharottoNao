import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const settings = await prisma.indexNowSetting.findFirst()

  if (!settings) {
    return null
  }

  return {
    apiKey: settings.apiKey,
    autoSubmissionEnabled: settings.autoSubmissionEnabled,
    dailyLimit: settings.dailyLimit,
  }
})

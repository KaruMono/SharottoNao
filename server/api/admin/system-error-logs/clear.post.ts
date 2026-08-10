import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { isMissingSystemErrorLogTable } from '~/server/utils/system-error-log'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  let deleted = 0

  try {
    const result = await prisma.systemErrorLog.deleteMany()
    deleted = result.count
  } catch (error) {
    if (!isMissingSystemErrorLogTable(error)) throw error
  }

  return {
    deleted,
  }
})

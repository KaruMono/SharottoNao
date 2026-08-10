import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const result = await prisma.indexNowSubmission.deleteMany({})

  return { deleted: result.count }
})

import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [successCount, failedCount, todayCount, totalCount] = await Promise.all([
    prisma.indexNowSubmission.count({
      where: { status: 'SUCCESS' },
    }),
    prisma.indexNowSubmission.count({
      where: { status: 'FAILED' },
    }),
    prisma.indexNowSubmission.count({
      where: {
        submittedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.indexNowSubmission.count(),
  ])

  return {
    successCount,
    failedCount,
    todayCount,
    totalCount,
  }
})

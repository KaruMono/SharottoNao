import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const submissions = await prisma.indexNowSubmission.findMany({
    orderBy: { submittedAt: 'desc' },
    take: 100, // 只返回最近 100 条
  })

  return submissions
})

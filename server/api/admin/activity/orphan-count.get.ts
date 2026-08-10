import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const existingGuideIds = (await prisma.guide.findMany({ select: { id: true } })).map(g => g.id)

  const count = await prisma.activity.count({
    where: {
      targetType: 'guide',
      ...(existingGuideIds.length > 0
        ? { targetId: { notIn: existingGuideIds } }
        : {}),
    },
  })

  return { count }
})

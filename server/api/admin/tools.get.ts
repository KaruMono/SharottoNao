import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const categoryId = query.categoryId ? parseInt(query.categoryId as string) : undefined

  const tools = await prisma.tool.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  })

  return tools
})

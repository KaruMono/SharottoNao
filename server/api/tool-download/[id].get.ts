import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const tool = await prisma.tool.findUnique({
    where: { id },
    include: {
      category: { select: { name: true, slug: true, icon: true } },
    },
  })

  if (!tool) {
    throw createError({ statusCode: 404, message: '工具不存在' })
  }

  return tool
})

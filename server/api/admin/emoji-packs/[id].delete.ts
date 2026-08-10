import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  await prisma.emojiPack.delete({
    where: { id },
  })

  return { success: true }
})

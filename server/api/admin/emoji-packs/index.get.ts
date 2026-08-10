import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const packs = await prisma.emojiPack.findMany({
    include: {
      emojis: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return packs
})

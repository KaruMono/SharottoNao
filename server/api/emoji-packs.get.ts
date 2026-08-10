import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const packs = await prisma.emojiPack.findMany({
    where: { isActive: true },
    include: {
      emojis: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return packs
})

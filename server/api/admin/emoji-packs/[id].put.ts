import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'
import { clearEmojiCache } from '~/server/utils/emoji'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  const pack = await prisma.emojiPack.update({
    where: { id },
    data,
  })

  // 清除表情缓存
  clearEmojiCache()

  return pack
})

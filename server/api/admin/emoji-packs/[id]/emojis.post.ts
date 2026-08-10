import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'
import { markImageAsUsed } from '~/server/utils/image'
import { clearEmojiCache } from '~/server/utils/emoji'

const schema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().min(1), // 允许相对路径，不强制要求完整 URL
  sortOrder: z.number().default(0),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const packId = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(packId)) {
    throw createError({ statusCode: 400, message: '无效的表情包ID' })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  // 检查表情包是否存在
  const pack = await prisma.emojiPack.findUnique({
    where: { id: packId },
  })

  if (!pack) {
    throw createError({ statusCode: 404, message: '表情包不存在' })
  }

  const emoji = await prisma.emoji.create({
    data: {
      ...data,
      packId,
    },
  })

  // 标记表情图片为已使用
  await markImageAsUsed(data.url)
  
  // 清除表情缓存
  clearEmojiCache()

  return emoji
})

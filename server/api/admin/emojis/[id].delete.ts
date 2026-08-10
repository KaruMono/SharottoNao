import prisma from '~/server/utils/prisma'
import { requireEditor } from '~/server/utils/auth'
import { markImageAsUnused } from '~/server/utils/image'
import { clearEmojiCache } from '~/server/utils/emoji'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  // 获取表情信息以便标记图片为未使用
  const emoji = await prisma.emoji.findUnique({
    where: { id },
  })

  if (emoji) {
    await prisma.emoji.delete({
      where: { id },
    })
    
    // 标记图片为未使用
    await markImageAsUnused(emoji.url)
    
    // 清除表情缓存
    clearEmojiCache()
  }

  return { success: true }
})

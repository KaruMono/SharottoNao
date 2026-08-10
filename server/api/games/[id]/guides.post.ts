import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { requireAuth } from '~/server/utils/auth'
import { sanitizeHtml, validateHtml } from '~/server/utils/html'
import { checkWriteRateLimit } from '~/server/utils/rate-limit'
import { recordActivity } from '~/server/utils/activity'
import { filterLinks, hasNonWhitelistedLinks } from '~/server/utils/link-filter'

const schema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  await checkWriteRateLimit(event, user.id)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  
  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: '无效的游戏ID' })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({ statusCode: 404, message: '游戏不存在' })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  // 验证 HTML
  const htmlValidation = validateHtml(data.content)
  if (!htmlValidation.valid) {
    throw createError({
      statusCode: 400,
      message: htmlValidation.error || '内容格式错误',
    })
  }

  // 清理 HTML
  let cleanContent = sanitizeHtml(data.content)
  
  // 过滤链接（移除非白名单链接）
  if (hasNonWhitelistedLinks(cleanContent)) {
    cleanContent = filterLinks(cleanContent, 'whitelist')
  }

  const guide = await prisma.guide.create({
    data: {
      title: data.title,
      content: cleanContent,
      gameId,
      userId: user.id,
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  })

  recordActivity({
    userId: user.id,
    type: 'CREATE_GUIDE',
    targetType: 'guide',
    targetId: guide.id,
    meta: {
      guideTitle: data.title,
      gameId,
      gameTitle: game.titleZhHans || game.titleJa || game.titleEn,
    },
  })

  return {
    ...guide,
    likeCount: 0,
    isLiked: false,
  }
})

import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { sanitizeHtml, validateHtml } from '~/server/utils/html'
import { filterLinks, hasNonWhitelistedLinks } from '~/server/utils/link-filter'

const schema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const guideId = parseInt(getRouterParam(event, 'id') || '')
  if (isNaN(guideId)) {
    throw createError({ statusCode: 400, message: '无效的攻略ID' })
  }

  const body = await readBody(event)
  const data = schema.parse(body)

  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: {
      id: true,
      userId: true,
      game: { select: { deletedAt: true } },
    },
  })

  if (!guide || guide.game.deletedAt) {
    throw createError({ statusCode: 404, message: '攻略不存在' })
  }

  if (guide.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: '无权编辑此攻略' })
  }

  const htmlValidation = validateHtml(data.content)
  if (!htmlValidation.valid) {
    throw createError({
      statusCode: 400,
      message: htmlValidation.error || '内容格式错误',
    })
  }

  let cleanContent = sanitizeHtml(data.content)

  if (hasNonWhitelistedLinks(cleanContent)) {
    cleanContent = filterLinks(cleanContent, 'whitelist')
  }

  const updatedGuide = await prisma.guide.update({
    where: { id: guideId },
    data: {
      title: data.title,
      content: cleanContent,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  })

  return updatedGuide
})

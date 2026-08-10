import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/slug'

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNsfw: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的标签ID',
    })
  }

  // 如果修改名称，检查是否已存在并更新 slug
  let slug: string | undefined
  if (data.name) {
    const existing = await prisma.tag.findFirst({
      where: {
        name: data.name,
        id: { not: id },
      },
    })

    if (existing) {
      throw createError({
        statusCode: 400,
        message: '该标签名称已存在',
      })
    }

    // 生成新的 slug
    slug = await generateUniqueSlug(data.name, async (s) => {
      const exists = await prisma.tag.findFirst({ 
        where: { slug: s, id: { not: id } } 
      })
      return !!exists
    })
  }

  const tag = await prisma.tag.update({
    where: { id },
    data: {
      ...data,
      ...(slug && { slug }),
    },
  })

  return tag
})

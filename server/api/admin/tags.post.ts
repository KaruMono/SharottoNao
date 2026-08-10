import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/slug'

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNsfw: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const existing = await prisma.tag.findUnique({
    where: { name: data.name },
  })

  if (existing) {
    throw createError({
      statusCode: 400,
      message: '该标签名称已存在',
    })
  }

  const slug = await generateUniqueSlug(data.name, async (s) => {
    const exists = await prisma.tag.findUnique({ where: { slug: s } })
    return !!exists
  })

  const tag = await prisma.tag.create({
    data: {
      ...data,
      slug,
    },
  })

  return tag
})

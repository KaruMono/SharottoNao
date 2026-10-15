import { createError } from 'h3'
import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { generateUniqueSlug } from '~/server/utils/slug'
import {
  assertTagNamesAvailableInTransaction,
  InvalidCanonicalTagNameError,
  isPrismaUniqueConstraintError,
  prepareTagNames,
  TagNameConflictError,
} from '~/server/utils/tag-name'

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNsfw: z.boolean().optional().default(false),
  aliases: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  try {
    const prepared = prepareTagNames(data.name, data.aliases)

    return await prisma.$transaction(async (tx) => {
      await assertTagNamesAvailableInTransaction(tx, prepared)

      const slug = await generateUniqueSlug(prepared.name, async (value) => {
        const exists = await tx.tag.findUnique({ where: { slug: value } })
        return Boolean(exists)
      })

      return tx.tag.create({
        data: {
          name: prepared.name,
          description: data.description,
          color: data.color,
          isNsfw: data.isNsfw,
          slug,
          aliases: prepared.aliases.length > 0 ? {
            create: prepared.aliases,
          } : undefined,
        },
        include: { aliases: true },
      })
    })
  } catch (error) {
    if (error instanceof InvalidCanonicalTagNameError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error instanceof TagNameConflictError) {
      throw createError({ statusCode: 409, message: error.message })
    }
    if (isPrismaUniqueConstraintError(error)) {
      throw createError({ statusCode: 409, message: '标签名称、别名或标识已被占用' })
    }
    throw error
  }
})

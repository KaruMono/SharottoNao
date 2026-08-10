import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { submitUrlToIndexNow } from '~/server/utils/indexnow'

const schema = z.object({
  name: z.string().min(1).max(255),
  nameOriginal: z.string().max(255).optional(),
  description: z.string().optional(),
  coverImage: z.string().max(500).optional(),
  isNsfw: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const series = await prisma.gameSeries.create({
    data,
  })

  // 只有非 NSFW 系列才提交到 IndexNow
  if (!series.isNsfw) {
    const config = useRuntimeConfig()
    const siteUrl = (config.public.siteUrl || 'http://localhost:3000').replace(/\/+$/, '')
    submitUrlToIndexNow(`${siteUrl}/series/${series.id}`, 'ADD').catch(err => {
      console.error('IndexNow submission failed:', err)
    })
  }

  return series
})

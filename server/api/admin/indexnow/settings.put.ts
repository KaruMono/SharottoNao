import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  autoSubmissionEnabled: z.boolean().optional(),
  dailyLimit: z.number().int().min(1).max(10000).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)

  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '数据验证失败',
    })
  }

  const settings = await prisma.indexNowSetting.findFirst()

  if (!settings) {
    throw createError({
      statusCode: 404,
      message: 'IndexNow 设置不存在，请先生成 API Key',
    })
  }

  await prisma.indexNowSetting.update({
    where: { id: settings.id },
    data: {
      ...(data.autoSubmissionEnabled !== undefined && { autoSubmissionEnabled: data.autoSubmissionEnabled }),
      ...(data.dailyLimit !== undefined && { dailyLimit: data.dailyLimit }),
    },
  })

  return { success: true }
})

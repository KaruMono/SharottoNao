import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // 生成 32 位随机 API Key
  const apiKey = crypto.randomBytes(16).toString('hex')

  // 检查是否已存在设置
  const existing = await prisma.indexNowSetting.findFirst()

  let settings
  if (existing) {
    // 更新现有设置
    settings = await prisma.indexNowSetting.update({
      where: { id: existing.id },
      data: { apiKey },
    })
  } else {
    // 创建新设置
    settings = await prisma.indexNowSetting.create({
      data: {
        apiKey,
        autoSubmissionEnabled: true,
      },
    })
  }

  return {
    apiKey: settings.apiKey,
    autoSubmissionEnabled: settings.autoSubmissionEnabled,
    dailyLimit: settings.dailyLimit,
  }
})

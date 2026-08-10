import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { createGameFromVndb } from '~/server/utils/resource-sync'

const schema = z.object({
  vndbIds: z.array(z.string().regex(/^v\d+$/)).min(1).max(20),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)

  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: '数据验证失败: ' + JSON.stringify(e.errors?.slice(0, 3)),
    })
  }

  const results = {
    created: 0,
    skipped: 0,
    failed: 0,
    failedIds: [] as string[],
    skippedIds: [] as string[],
  }

  for (const vndbId of data.vndbIds) {
    try {
      // 1. 检查是否已存在
      const existing = await prisma.game.findFirst({
        where: { vndbId, deletedAt: null },
      })

      if (existing) {
        results.skipped++
        results.skippedIds.push(vndbId)
        continue
      }

      await createGameFromVndb(vndbId, admin.id, 'admin-quick-import')
      results.created++
    } catch (err: any) {
      if (err?.statusCode === 422) {
        results.skipped++
        results.skippedIds.push(vndbId)
        continue
      }
      console.error(`Failed to import ${vndbId}:`, err)
      results.failed++
      results.failedIds.push(vndbId)
    }

    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return results
})

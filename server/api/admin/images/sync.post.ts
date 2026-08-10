import { requireEditor } from '~/server/utils/auth'
import { syncAllImageUsageStatus } from '~/server/utils/image'

export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const result = await syncAllImageUsageStatus()

  return {
    success: true,
    message: `已同步 ${result.updated} 张图片的使用状态${result.errors > 0 ? `，${result.errors} 张同步失败` : ''}`,
    ...result,
  }
})

import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { requireAdmin } from '~/server/utils/auth'
import { removeStaleMachineTranslationTags } from '~/server/utils/machine-translation-tag'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const count = await removeStaleMachineTranslationTags()

  await logAdminOperation({
    adminId: admin.id,
    action: 'CLEANUP_STALE_MACHINE_TRANSLATION_TAGS',
    targetType: 'GameTag',
    content: `清理无有效机翻资源的“机器翻译”标签关联 ${count} 条`,
  })

  return {
    success: true,
    count,
    message: count > 0 ? `已移除 ${count} 个错误的机器翻译标签` : '没有需要清理的机器翻译标签',
  }
})

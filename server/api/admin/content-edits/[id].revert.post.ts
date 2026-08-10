import { requireEditor } from '~/server/utils/auth'
import { revertToSnapshot } from '~/server/utils/content-edit'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的记录ID' })
  }

  const edit = await prisma.contentEdit.findUnique({ where: { id } })
  if (!edit) {
    throw createError({ statusCode: 404, message: '编辑记录不存在' })
  }

  await revertToSnapshot(id, user.id)

  await logAdminOperation({
    adminId: user.id,
    action: 'REVERT_EDIT',
    targetType: edit.targetType,
    targetId: edit.targetId,
    content: `撤销到编辑记录 #${id}（${edit.targetType} #${edit.targetId}）`,
  })

  return { success: true, message: '已成功撤销到该版本' }
})

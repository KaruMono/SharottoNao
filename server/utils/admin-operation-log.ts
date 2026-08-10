import prisma from '~/server/utils/prisma'

export async function logAdminOperation(input: {
  adminId: number
  action: string
  targetType?: string
  targetId?: number
  content: string
}) {
  const { adminId, action, targetType, targetId, content } = input

  await prisma.adminOperationLog.create({
    data: {
      adminId,
      action,
      targetType: targetType || null,
      targetId: targetId ?? null,
      content,
    },
  })
}

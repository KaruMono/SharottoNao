import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import { sendPasswordResetEmail } from '~/server/utils/mail'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  // 生成验证码
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15分钟有效期

  await prisma.verificationCode.create({
    data: {
      email: user.email,
      code,
      type: 'RESET_PASSWORD',
      expiresAt,
    },
  })

  // 发送邮件
  try {
    await sendPasswordResetEmail(user.email, code)
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: '邮件发送失败',
    })
  }

  await logAdminOperation({
    adminId: admin.id,
    action: 'SEND_RESET_EMAIL',
    targetType: 'User',
    targetId: id,
    content: `发送重置密码邮件: ${user.username}(#${id})`,
  })

  return { success: true, message: '重置密码邮件已发送' }
})

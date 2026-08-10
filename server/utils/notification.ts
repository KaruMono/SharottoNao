import type { MessageType } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { sendNotificationEmail } from '~/server/utils/mail'

interface SendNotificationParams {
  senderId?: number | null
  receiverId: number
  type: MessageType
  title: string
  content: string
  relatedUrl?: string
  isNsfw?: boolean
}

/**
 * 判断是否应该在该数量时发送里程碑通知
 * 里程碑: 1, 10, 100, 500, 1000, 5000, 10000, 20000, 50000, 100000...
 */
export function shouldSendMilestoneNotification(count: number): boolean {
  if (count <= 0) return false
  
  // 第一个里程碑
  if (count === 1) return true
  
  // 10, 100, 1000, 10000... (10的幂次)
  if (count >= 10 && Math.log10(count) % 1 === 0) return true
  
  // 500, 5000, 50000... (5 * 10的幂次)
  if (count >= 500 && count % 500 === 0 && Math.log10(count / 5) % 1 === 0) return true
  
  // 2000, 20000, 200000... (2 * 10的幂次)
  if (count >= 2000 && count % 2000 === 0 && Math.log10(count / 2) % 1 === 0) return true
  
  return false
}

export async function sendNotification(params: SendNotificationParams) {
  const { senderId, receiverId, type, title, content, relatedUrl, isNsfw } = params

  // 1. 始终创建站内消息
  await prisma.message.create({
    data: {
      senderId: senderId ?? null,
      receiverId,
      type,
      title,
      content,
      relatedUrl: relatedUrl ?? null,
      isNsfw: isNsfw ?? false,
    },
  })

  // 2. 查询用户全局开关和对应类型偏好
  try {
    const user = await prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        email: true,
        emailNotify: true,
        notificationPreferences: {
          where: { messageType: type },
        },
      },
    })

    if (!user || !user.emailNotify) return

    // 无对应类型偏好记录时默认视为启用
    const pref = user.notificationPreferences[0]
    const emailEnabled = pref ? pref.emailEnabled : true

    if (emailEnabled) {
      await sendNotificationEmail(user.email, type, title, content, relatedUrl)
    }
  } catch (err) {
    // SMTP 失败不影响站内消息
    console.error('[notification] 邮件发送失败:', err)
  }
}

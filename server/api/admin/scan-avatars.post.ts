import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { resolveDefaultAvatar, isGeneratedAvatar, isUploadedAvatar } from '~/server/utils/gravatar'

const bodySchema = z.object({
  userId: z.number().int().positive(),
})

function getAvatarStatus(avatar: string | null): 'uploaded' | 'generated' | 'missing' | 'other' {
  if (isUploadedAvatar(avatar)) return 'uploaded'
  if (isGeneratedAvatar(avatar)) return 'generated'
  if (!avatar) return 'missing'
  return 'other'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = bodySchema.parse(await readBody(event))
  const user = await prisma.user.findUnique({
    where: { id: body.userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
    },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const status = getAvatarStatus(user.avatar)
  if (status === 'uploaded') {
    return {
      userId: user.id,
      username: user.username,
      skipped: true,
      status,
      message: '已上传自定义头像，已跳过',
    }
  }

  const nextAvatar = await resolveDefaultAvatar(user.email)
  const changed = user.avatar !== nextAvatar

  if (changed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: nextAvatar },
    })
  }

  return {
    userId: user.id,
    username: user.username,
    skipped: false,
    status,
    changed,
    avatar: nextAvatar,
    message: changed ? (nextAvatar ? '已设置 Gravatar 头像' : '无 Gravatar，已恢复站内默认头像') : '头像已是最新',
  }
})
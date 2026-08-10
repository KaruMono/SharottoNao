import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { resolveDefaultAvatar, isGeneratedAvatar, isUploadedAvatar } from '~/server/utils/gravatar'

function getAvatarStatus(avatar: string | null): 'uploaded' | 'generated' | 'missing' | 'other' {
  if (isUploadedAvatar(avatar)) return 'uploaded'
  if (isGeneratedAvatar(avatar)) return 'generated'
  if (!avatar) return 'missing'
  return 'other'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
    },
    orderBy: { id: 'asc' },
  })

  const items = await Promise.all(users.map(async user => {
    const status = getAvatarStatus(user.avatar)
    const nextAvatar = status === 'uploaded' ? user.avatar : await resolveDefaultAvatar(user.email)

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      status,
      skipped: status === 'uploaded',
      nextAvatar,
    }
  }))

  return {
    total: items.length,
    candidates: items.filter(item => !item.skipped).length,
    uploadedSkipped: items.filter(item => item.status === 'uploaded').length,
    generated: items.filter(item => item.status === 'generated').length,
    missing: items.filter(item => item.status === 'missing').length,
    other: items.filter(item => item.status === 'other').length,
    users: items,
  }
})
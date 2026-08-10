import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'

function isAllowedAvatarUrl(avatar: string): boolean {
  if (avatar.startsWith('/uploads/avatars/') || avatar.startsWith('/uploads/images/')) {
    return true
  }

  const config = useRuntimeConfig()
  const prefixes = [
    config.s3?.publicUrl,
    config.s3?.endpoint && config.s3?.bucket ? `${config.s3.endpoint}/${config.s3.bucket}` : '',
    config.public?.cdnUrl,
  ]
    .map(value => String(value || '').replace(/\/+$/, ''))
    .filter(Boolean)

  return prefixes.some(prefix =>
    avatar.startsWith(`${prefix}/avatars/`) || avatar.startsWith(`${prefix}/images/`),
  )
}

const schema = z.object({
  username: z.string()
    .min(2, '用户名至少2个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文')
    .optional(),
  bio: z.string().max(200, '简介最多200个字符').optional(),
  avatar: z.string().max(500).refine(isAllowedAvatarUrl, '头像必须来自本站上传').optional(),
  emailNotify: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  // 如果要修改用户名，检查是否已存在
  if (data.username && data.username !== user.username) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    })
    if (existing) {
      throw createError({
        statusCode: 400,
        message: '用户名已被使用',
      })
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.username && { username: data.username }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.emailNotify !== undefined && { emailNotify: data.emailNotify }),
    },
  })

  // 更新头像图片使用状态
  if (data.avatar !== undefined && data.avatar !== user.avatar) {
    await markImageAsUnused(user.avatar)
    await markImageAsUsed(data.avatar)
  }

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    avatar: updatedUser.avatar,
    bio: updatedUser.bio,
    role: updatedUser.role,
    nsfwMode: updatedUser.nsfwMode,
    emailNotify: updatedUser.emailNotify,
  }
})

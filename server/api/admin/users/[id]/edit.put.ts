import { z } from 'zod'
import { requireAdmin, invalidateUserTokens } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { logAdminOperation } from '~/server/utils/admin-operation-log'
import bcrypt from 'bcryptjs'

const schema = z.object({
  username: z.string().min(1).max(50).optional(),
  email: z.string().email().max(255).transform(v => v.toLowerCase()).optional(),
  password: z.string().min(6).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  unlimitedDownload: z.boolean().optional(),
  title: z.string().max(50).optional().nullable(),
  titleColor: z.string().max(20).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: '用户不存在',
    })
  }

  // 检查用户名是否已被使用
  if (data.username && data.username !== user.username) {
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    })
    if (existingUser) {
      throw createError({
        statusCode: 400,
        message: '用户名已被使用',
      })
    }
  }

  // 检查邮箱是否已被使用
  if (data.email && data.email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })
    if (existingUser) {
      throw createError({
        statusCode: 400,
        message: '邮箱已被使用',
      })
    }
  }

  // 准备更新数据
  const updateData: any = {}
  if (data.username) updateData.username = data.username
  if (data.email) updateData.email = data.email
  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10)
  }
  if (data.unlimitedDownload !== undefined) updateData.unlimitedDownload = data.unlimitedDownload
  if (data.title !== undefined) updateData.title = data.title
  if (data.titleColor !== undefined) updateData.titleColor = data.titleColor

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...updateData,
      ...((data.password || data.email) ? { tokenVersion: { increment: 1 } } : {}),
    },
  })

  if (data.password || data.email) {
    await invalidateUserTokens(id)
  }

  const changes: string[] = []
  if (data.username && data.username !== user.username) changes.push(`username: ${user.username} -> ${data.username}`)
  if (data.email && data.email !== user.email) changes.push(`email: ${user.email} -> ${data.email}`)
  if (data.password) changes.push('password: updated')
  if (data.bio !== undefined) changes.push('bio: updated')
  if (data.unlimitedDownload !== undefined) changes.push(`unlimitedDownload: ${data.unlimitedDownload}`)

  await logAdminOperation({
    adminId: admin.id,
    action: 'EDIT_USER',
    targetType: 'User',
    targetId: id,
    content: `编辑用户: ${user.username}(#${id}); ${changes.join('; ')}`,
  })

  return { success: true, message: '更新成功' }
})

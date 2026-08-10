import { z } from 'zod'
import { requireAdmin } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'

const schema = z.object({
  name: z.string().min(1, '请输入会社名称').max(255),
  nameOriginal: z.string().max(255).optional(),
  logo: z.string().max(500).optional(),
  aliases: z.array(z.string().max(255)).optional().default([]),
  description: z.string().optional(),
  foundedYear: z.number().min(1900).max(2100).optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
})

// 获取名称首字母索引
function getNameIndex(name: string): string {
  const firstChar = name.charAt(0).toUpperCase()
  if (/[A-Z]/.test(firstChar)) {
    return firstChar
  }
  return '#'
}

// 创建会社需要管理员权限
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readBody(event)
  const data = schema.parse(body)

  const company = await prisma.company.create({
    data: {
      name: data.name,
      nameOriginal: data.nameOriginal,
      nameIndex: getNameIndex(data.name),
      logo: data.logo,
      aliases: data.aliases || [],
      description: data.description,
      foundedYear: data.foundedYear,
      website: data.website || null,
      creatorId: user.id,
    },
  })

  return { id: company.id, message: '创建成功' }
})

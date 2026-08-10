import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed } from '~/server/utils/image'
import { submitCompanyToIndexNow } from '~/server/utils/indexnow'

const schema = z.object({
  name: z.string().min(1, '请输入会社名称').max(255),
  nameOriginal: z.string().max(255).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
  aliases: z.array(z.string().max(255)).optional().default([]),
  description: z.string().optional().nullable(),
  foundedYear: z.number().min(1900).max(2100).optional().nullable(),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')).or(z.null()),
  parentId: z.number().int().positive().optional().nullable(),
})

// 获取名称首字母索引
function getNameIndex(name: string): string {
  const firstChar = name.charAt(0).toUpperCase()
  if (/[A-Z]/.test(firstChar)) {
    return firstChar
  }
  return '#'
}

export default defineEventHandler(async (event) => {
  const user = await requireEditor(event)
  const body = await readBody(event)
  
  let data
  try {
    data = schema.parse(body)
  } catch (e: any) {
    console.error('Validation error:', e.errors)
    throw createError({
      statusCode: 400,
      message: '数据验证失败: ' + JSON.stringify(e.errors),
    })
  }

  const company = await prisma.company.create({
    data: {
      name: data.name,
      nameOriginal: data.nameOriginal || null,
      nameIndex: getNameIndex(data.name),
      logo: data.logo || null,
      aliases: data.aliases || [],
      description: data.description || null,
      foundedYear: data.foundedYear || null,
      website: data.website || null,
      parentId: data.parentId || null,
      creatorId: user.id,
    },
  })

  // 标记Logo图片为已使用
  if (data.logo) {
    await markImageAsUsed(data.logo)
  }

  // 提交到 IndexNow
  submitCompanyToIndexNow(company.id, 'ADD').catch(err => {
    console.error('IndexNow submission failed:', err)
  })

  return { id: company.id, message: '创建成功' }
})

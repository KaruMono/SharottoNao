import { z } from 'zod'
import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { markImageAsUsed, markImageAsUnused } from '~/server/utils/image'
import { recordEdit } from '~/server/utils/content-edit'
import { submitCompanyToIndexNow } from '~/server/utils/indexnow'

const schema = z.object({
  name: z.string().min(1, '请输入会社名称').max(255),
  nameOriginal: z.string().max(255).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
  aliases: z.array(z.string().max(255)).optional().default([]),
  description: z.string().optional().nullable(),
  foundedYear: z.number().min(1900).max(2100).optional().nullable(),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')),
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

  const id = parseInt(getRouterParam(event, 'id') as string)
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的会社ID',
    })
  }
  const existingCompany = await prisma.company.findUnique({
    where: { id },
  })

  if (!existingCompany) {
    throw createError({
      statusCode: 404,
      message: '会社不存在',
    })
  }

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

  // 防止将自己设为父会社
  if (data.parentId === id) {
    throw createError({ statusCode: 400, message: '不能将自己设为父会社' })
  }

  const company = await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      nameOriginal: data.nameOriginal || null,
      nameIndex: getNameIndex(data.name),
      logo: data.logo || null,
      aliases: data.aliases || [],
      description: data.description || null,
      foundedYear: data.foundedYear || null,
      website: data.website || null,
      parentId: data.parentId !== undefined ? (data.parentId || null) : undefined,
    },
  })

  // 记录编辑历史快照
  await recordEdit({
    targetType: 'COMPANY',
    targetId: id,
    editorId: user.id,
    snapshot: existingCompany as unknown as Record<string, unknown>,
    changeSummary: `编辑公司信息`,
  })

  // 更新Logo图片使用状态
  if (existingCompany.logo !== data.logo) {
    await markImageAsUnused(existingCompany.logo)
    if (data.logo) {
      await markImageAsUsed(data.logo)
    }
  }

  // 提交到 IndexNow
  submitCompanyToIndexNow(id, 'UPDATE').catch(err => {
    console.error('IndexNow submission failed:', err)
  })

  return { success: true, id: company.id }
})

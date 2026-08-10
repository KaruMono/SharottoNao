import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { updateMachineTranslationTag } from '~/server/utils/machine-translation-tag'
import { invalidateCache, invalidateGameCaches } from '~/server/utils/redis'
import { detectNetDiskTypeId } from '~/server/utils/net-disk'

const schema = z.object({
  typeId: z.number().optional(),
  title: z.string().min(1, '请输入资源标题').max(255).optional(),
  url: z.string().url('请输入有效的链接').max(1000).optional(),
  extractCode: z.string().max(50).optional().nullable(),
  unzipPassword: z.string().max(100).optional().nullable(),
  remark: z.string().max(500).optional().nullable(),
  language: z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'], { required_error: '请选择游戏语言' }),
  fileSize: z.string().min(1, '请输入文件大小').max(20).regex(/^[\d.]+[MG]$/i, '文件大小必须以M或G结尾，如：1.2G、800M'),
  isMachineTranslated: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const resourceId = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)

  if (isNaN(resourceId)) {
    throw createError({
      statusCode: 400,
      message: '无效的资源ID',
    })
  }

  // 获取资源
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId, deletedAt: null },
    include: { game: { select: { deletedAt: true } } },
  })

  if (!resource || resource.game.deletedAt) {
    throw createError({
      statusCode: 404,
      message: '资源不存在',
    })
  }

  // 检查权限：只有上传者或管理员可以编辑
  if (resource.uploaderId !== user.id && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: '没有权限编辑此资源',
    })
  }

  // 如果修改了资源类型，验证类型是否存在
  if (data.typeId) {
    const resourceType = await prisma.resourceType.findUnique({
      where: { id: data.typeId },
    })
    if (!resourceType) {
      throw createError({
        statusCode: 400,
        message: '无效的资源类型',
      })
    }
  }

  const netDiskTypeId = data.url !== undefined
    ? await detectNetDiskTypeId(data.url)
    : resource.netDiskTypeId

  // 更新资源
  const updatedResource = await prisma.resource.update({
    where: { id: resourceId },
    data: {
      typeId: data.typeId ?? resource.typeId,
      title: data.title ?? resource.title,
      url: data.url ?? resource.url,
      extractCode: data.extractCode !== undefined ? data.extractCode : resource.extractCode,
      unzipPassword: data.unzipPassword !== undefined ? data.unzipPassword : resource.unzipPassword,
      remark: data.remark !== undefined ? data.remark : resource.remark,
      language: data.language !== undefined ? data.language : resource.language,
      fileSize: data.fileSize !== undefined ? data.fileSize : resource.fileSize,
      isMachineTranslated: data.isMachineTranslated !== undefined ? data.isMachineTranslated : resource.isMachineTranslated,
      netDiskTypeId,
    },
    include: {
      type: true,
      uploader: {
        select: { id: true, username: true },
      },
    },
  })

  // 如果修改了机翻状态，更新机器翻译标签
  if (data.isMachineTranslated !== undefined && data.isMachineTranslated !== resource.isMachineTranslated) {
    updateMachineTranslationTag(resource.gameId).catch(err => {
      console.error('Failed to update machine translation tag:', err)
    })
  }

  invalidateGameCaches(resource.gameId).catch(() => {})
  invalidateCache('user:*').catch(() => {})

  return updatedResource
})

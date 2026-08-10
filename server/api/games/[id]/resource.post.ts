import { z } from 'zod'
import { requireAuth } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { recordActivity } from '~/server/utils/activity'
import { updateMachineTranslationTag } from '~/server/utils/machine-translation-tag'
import { detectNetDiskTypeId } from '~/server/utils/net-disk'

const schema = z.object({
  typeId: z.number(),
  title: z.string().min(1, '请输入资源标题').max(255),
  url: z.string().url('请输入有效的链接').max(1000),
  extractCode: z.string().max(50).optional(),
  unzipPassword: z.string().max(100).optional(),
  remark: z.string().max(500).optional(),
  language: z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant'], { required_error: '请选择游戏语言' }),
  fileSize: z.string().min(1, '请输入文件大小').max(20).regex(/^[\d.]+[MG]$/i, '文件大小必须以M或G结尾，如：1.2G、800M'),
  isMachineTranslated: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const gameId = parseInt(getRouterParam(event, 'id') as string)
  const body = await readBody(event)
  const data = schema.parse(body)
  
  if (isNaN(gameId)) {
    throw createError({
      statusCode: 400,
      message: '无效的条目ID',
    })
  }

  // 检查游戏是否存在
  const game = await prisma.game.findUnique({
    where: { id: gameId, deletedAt: null },
  })

  if (!game) {
    throw createError({
      statusCode: 404,
      message: '条目不存在',
    })
  }

  // 检查资源类型是否存在
  const resourceType = await prisma.resourceType.findUnique({
    where: { id: data.typeId },
  })

  if (!resourceType) {
    throw createError({
      statusCode: 400,
      message: '无效的资源类型',
    })
  }

  // 创建资源（管理员/编辑自动审核通过，普通用户待审核）
  const autoApprove = user.role === 'ADMIN' || user.role === 'EDITOR'
  const netDiskTypeId = await detectNetDiskTypeId(data.url)
  const resource = await prisma.resource.create({
    data: {
      gameId,
      typeId: data.typeId,
      uploaderId: user.id,
      title: data.title,
      url: data.url,
      extractCode: data.extractCode,
      unzipPassword: data.unzipPassword,
      remark: data.remark,
      language: data.language,
      fileSize: data.fileSize,
      isMachineTranslated: data.isMachineTranslated ?? false,
      netDiskTypeId,
      status: autoApprove ? 'APPROVED' : 'PENDING',
    },
    include: {
      type: true,
      uploader: {
        select: { id: true, username: true },
      },
    },
  })

  recordActivity({
    userId: user.id,
    type: 'EDIT_GAME',
    targetType: 'game',
    targetId: gameId,
    meta: {
      gameTitle: game.titleZhHans || game.titleJa || game.titleEn || `Game #${gameId}`,
      gameCover: game.coverImage,
      action: '添加下载资源',
    },
  })

  // 如果是机翻资源且自动审核通过，更新机器翻译标签
  if (autoApprove && data.isMachineTranslated) {
    updateMachineTranslationTag(gameId).catch(err => {
      console.error('Failed to update machine translation tag:', err)
    })
  }

  return resource
})

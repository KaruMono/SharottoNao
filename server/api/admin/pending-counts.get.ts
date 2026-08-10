import { requireEditor } from '~/server/utils/auth'
import prisma from '~/server/utils/prisma'
import { isMissingSystemErrorLogTable } from '~/server/utils/system-error-log'

async function countSystemErrors() {
  try {
    return await prisma.systemErrorLog.count()
  } catch (error) {
    if (isMissingSystemErrorLogTable(error)) return 0
    console.error('[pending-counts] 统计系统错误日志失败:', error)
    return 0
  }
}

export default defineEventHandler(async (event) => {
  await requireEditor(event)
  
  const [editRequests, resources, reports, systemErrors] = await Promise.all([
    prisma.gameEditRequest.count({ where: { status: 'PENDING' } }),
    prisma.resource.count({ where: { status: 'PENDING', deletedAt: null } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    countSystemErrors(),
  ])
  
  return {
    editRequests,
    resources,
    reports,
    systemErrors,
  }
})

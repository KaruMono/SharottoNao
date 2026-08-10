import prisma from '~/server/utils/prisma'

type RecordSystemErrorInput = {
  type: string
  source?: string
  message: string
  detail?: string
  metadata?: unknown
}

export function isMissingSystemErrorLogTable(error: unknown) {
  const err = error as { code?: string; message?: string }
  return err?.code === 'P2021' || Boolean(err?.message?.includes('SystemErrorLog') && err.message.includes('does not exist'))
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

function normalizeErrorDetail(error: unknown) {
  if (error instanceof Error) return error.stack || error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function normalizeMetadata(metadata: unknown) {
  if (metadata === undefined) return undefined

  try {
    return JSON.parse(JSON.stringify(metadata))
  } catch {
    return { value: String(metadata) }
  }
}

export function serializeSystemError(error: unknown) {
  return {
    message: normalizeErrorMessage(error),
    detail: normalizeErrorDetail(error),
  }
}

export async function recordSystemError(input: RecordSystemErrorInput) {
  try {
    await prisma.systemErrorLog.create({
      data: {
        type: input.type,
        source: input.source,
        message: input.message,
        detail: input.detail,
        metadata: normalizeMetadata(input.metadata) as any,
      },
    })
  } catch (error) {
    if (isMissingSystemErrorLogTable(error)) return
    console.error('[system-error-log] 记录错误日志失败:', error)
  }
}

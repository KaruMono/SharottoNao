import prisma from '~/server/utils/prisma'

export interface HealthResult {
  status: 'ok' | 'unavailable'
  buildId: string
  releaseId: string
  database: 'ok' | 'error'
  uptime: number
}

export async function getHealthResult(): Promise<HealthResult> {
  const config = useRuntimeConfig()
  const buildId = String(config.public?.buildId || 'unknown')
  const releaseId = String(config.releaseId || buildId)

  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      buildId,
      releaseId,
      database: 'ok',
      uptime: Math.round(process.uptime()),
    }
  } catch {
    return {
      status: 'unavailable',
      buildId,
      releaseId,
      database: 'error',
      uptime: Math.round(process.uptime()),
    }
  }
}

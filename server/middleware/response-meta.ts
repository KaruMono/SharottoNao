import { randomUUID } from 'node:crypto'
import { getHeader, setHeader } from 'h3'

/** Add release metadata to every response for deployment diagnostics. */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const buildId = String(config.public?.buildId || 'unknown')
  const releaseId = String(config.releaseId || buildId)
  const incomingRequestId = getHeader(event, 'x-request-id')?.trim() || ''
  const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID()

  event.context.requestId = requestId
  setHeader(event, 'X-Charlotte-Build', buildId)
  setHeader(event, 'X-Charlotte-Release', releaseId)
  setHeader(event, 'X-Request-Id', requestId)
})

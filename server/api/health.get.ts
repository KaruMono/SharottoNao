import { getHealthResult } from '~/server/utils/health'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  })

  const result = await getHealthResult()
  if (result.status !== 'ok') setResponseStatus(event, 503, 'Service Unavailable')
  return result
})

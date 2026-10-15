export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  })
  const config = useRuntimeConfig()
  const buildId = String(config.public?.buildId || 'unknown')
  return {
    buildId,
    releaseId: String(config.releaseId || buildId),
  }
})

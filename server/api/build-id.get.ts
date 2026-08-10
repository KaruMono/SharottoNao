export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return { buildId: config.public.buildId }
})

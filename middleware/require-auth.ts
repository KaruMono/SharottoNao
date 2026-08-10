export default defineNuxtRouteMiddleware(async (to) => {
  const { status, getSession } = useAuth()

  if (status.value === 'loading') {
    await getSession()
  }

  if (status.value !== 'authenticated') {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})

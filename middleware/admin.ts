export default defineNuxtRouteMiddleware(async () => {
  const { data: session, status, getSession } = useAuth()

  if (status.value === 'loading') {
    await getSession()
  }

  if (status.value !== 'authenticated') {
    return navigateTo('/login')
  }

  const user = session.value as any
  if (user?.role !== 'ADMIN' && user?.role !== 'EDITOR') {
    return navigateTo('/')
  }
})

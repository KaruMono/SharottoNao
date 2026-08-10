/**
 * 创建带认证的 API 实例
 * 自动为所有请求添加 Authorization header
 */
export default defineNuxtPlugin(() => {
  const { token } = useAuth()

  const api = $fetch.create({
    onRequest({ options }) {
      // 如果有 token，添加到请求头
      // 注意：@sidebase/nuxt-auth 的 token 已经包含 "Bearer " 前缀
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit)
        headers.set('Authorization', token.value)
        options.headers = headers
      }
    },
    onResponseError({ response }) {
      // 如果是 401 错误且不是登录页面，可以选择重定向到登录页
      if (response.status === 401) {
        console.warn('API 请求返回 401，可能需要重新登录')
      }
    },
  })

  return {
    provide: {
      api,
    },
  }
})

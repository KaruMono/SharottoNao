import type { NitroFetchRequest } from 'nitropack'

type AuthRequestOptions = any

type AuthRequest = <T = unknown>(url: string, options?: AuthRequestOptions) => Promise<T>

/**
 * 带认证的 useFetch 封装
 * 自动在请求头中添加 Authorization token
 */
export function useAuthFetch<T = unknown>(
  url: any,
  options: any = {}
): any {
  const { token } = useAuth()

  return (useFetch as any)(url as any, {
    ...(options as any),
    onRequest({ options: reqOptions }) {
      if (token.value) {
        const headers = new Headers(reqOptions.headers as HeadersInit)
        headers.set('Authorization', token.value)
        reqOptions.headers = headers
      }
    },
  } as any)
}

/**
 * 带认证的 $fetch 封装
 * 使用插件提供的 $api 实例，或者手动添加 token
 */
export function useAuthRequest() {
  const { $api } = useNuxtApp()
  
  // 如果插件已加载，使用 $api
  if ($api) {
    return { authFetch: $api as AuthRequest }
  }
  
  // 降级方案：手动添加 token
  const { token } = useAuth()

  const authFetch: AuthRequest = async <T = unknown>(
    url: string,
    options: AuthRequestOptions = {}
  ): Promise<T> => {
    // 对于 FormData 请求体，不要手动构建 headers 对象，
    // 否则会丢失浏览器自动生成的 Content-Type（包含 multipart boundary）
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    
    if (isFormData) {
      // FormData 请求：只添加 Authorization，不干扰 Content-Type
      const headers = new Headers()
      if (token.value) {
        headers.set('Authorization', token.value)
      }
      return ($fetch as any)(url, {
        ...options,
        headers,
      }) as Promise<T>
    }
    
    // 非 FormData 请求：正常处理 headers
    const headers: Record<string, string> = {}
    
    // 复制现有 headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, options.headers)
      }
    }
    
    // 添加 token
    // 注意：@sidebase/nuxt-auth 的 token 已经包含 "Bearer " 前缀
    if (token.value) {
      headers.Authorization = token.value
    }

    return ($fetch as any)(url, {
      ...options,
      headers,
    }) as Promise<T>
  }

  return { authFetch }
}

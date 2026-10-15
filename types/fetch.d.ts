// 修复 Nuxt 4 中 $fetch 的类型推断问题
declare module '#app' {
  interface NuxtApp {
    $fetch: typeof $fetch
  }
}

declare global {
  const $fetch: <T = any>(url: string, options?: any) => Promise<T>
}

export {}

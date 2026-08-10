/**
 * 全局站点名称 composable
 * 通过 useState 在客户端/服务端共享站点名称
 */
export function useSiteName() {
  return useState<string>('siteName', () => 'Charlotte')
}

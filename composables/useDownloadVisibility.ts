export type DownloadVisibility = 'login_required' | 'always_show'

/**
 * 全局下载可见性设置
 * login_required: 需要登录才能看到下载列表（默认）
 * always_show:    所有人都能看到下载列表，点击下载时再要求登录
 */
export function useDownloadVisibility() {
  return useState<DownloadVisibility>('downloadVisibility', () => 'login_required')
}

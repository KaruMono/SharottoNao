/**
 * 共享「在新窗口打开」设置
 * 使用 useState 保证多组件间状态同步，避免各自读写 localStorage
 */
export function useOpenInNewTab() {
  const openInNewTab = useState('openInNewTab', () => false)

  function toggleOpenInNewTab() {
    openInNewTab.value = !openInNewTab.value
    if (import.meta.client) {
      localStorage.setItem('openInNewTab', String(openInNewTab.value))
    }
  }

  onMounted(() => {
    openInNewTab.value = localStorage.getItem('openInNewTab') === 'true'
  })

  return { openInNewTab, toggleOpenInNewTab }
}

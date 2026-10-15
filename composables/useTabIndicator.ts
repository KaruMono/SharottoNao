import { ref, watch, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'

export function useTabIndicator(activeValue: Ref<string>) {
  const tabContainer = ref<HTMLElement>()
  const indicatorStyle = ref({ width: '0px', transform: 'translateX(0px)' })

  function updateIndicator() {
    const activeTab = tabContainer.value?.querySelector<HTMLElement>('button[aria-pressed="true"]')
    if (!activeTab) return

    indicatorStyle.value = {
      width: `${activeTab.offsetWidth}px`,
      transform: `translateX(${activeTab.offsetLeft}px)`,
    }
  }

  // The content-sized container also resizes when fonts, badges or padding change.
  useResizeObserver(tabContainer, updateIndicator)
  watch(activeValue, updateIndicator, { flush: 'post' })

  return { tabContainer, indicatorStyle }
}

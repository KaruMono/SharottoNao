export interface GlobalAnnouncement {
  title: string
  content: string
  buttonText: string
  frequency: 'once' | 'daily' | 'always'
}

export function useGlobalAnnouncement() {
  const showGlobalAnnouncement = ref(false)
  const globalAnnouncement = ref<GlobalAnnouncement | null>(null)

  async function fetchGlobalAnnouncement() {
    try {
      const data: any = await ($fetch as any)('/api/announcements/settings')

      if (data.global?.isActive) {
        const announcement = data.global
        const storageKey = 'global_announcement_dismissed'
        const lastDismissed = localStorage.getItem(storageKey)
        
        let shouldShow = false
        if (announcement.frequency === 'always') {
          shouldShow = true
        } else if (announcement.frequency === 'daily') {
          const today = new Date().toDateString()
          shouldShow = lastDismissed !== today
        } else if (announcement.frequency === 'once') {
          shouldShow = !lastDismissed
        }
        
        if (shouldShow) {
          globalAnnouncement.value = announcement
          showGlobalAnnouncement.value = true
        }
      }
    } catch {
      // 忽略错误
    }
  }

  function closeGlobalAnnouncement() {
    showGlobalAnnouncement.value = false
    
    if (globalAnnouncement.value) {
      const storageKey = 'global_announcement_dismissed'
      if (globalAnnouncement.value.frequency === 'daily') {
        localStorage.setItem(storageKey, new Date().toDateString())
      } else if (globalAnnouncement.value.frequency === 'once') {
        localStorage.setItem(storageKey, 'true')
      }
    }
  }

  return {
    showGlobalAnnouncement,
    globalAnnouncement,
    fetchGlobalAnnouncement,
    closeGlobalAnnouncement,
  }
}

export interface BgSettingsState {
  enabled: boolean
  imageUrl: string
  opacity: number
  blur: number
}

export function useBgSettings() {
  const showBgSettingsModal = ref(false)

  const bgSettings = reactive<BgSettingsState>({
    enabled: false,
    imageUrl: '',
    opacity: 0.5,
    blur: 0,
  })

  const bgPreview = reactive<BgSettingsState>({
    enabled: false,
    imageUrl: '',
    opacity: 0.5,
    blur: 0,
  })

  const bgImageInputRef = ref<HTMLInputElement | null>(null)
  const bgUploading = ref(false)

  function openBgSettings() {
    Object.assign(bgPreview, bgSettings)
    showBgSettingsModal.value = true
  }

  function handleBgImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    if (file.size > 2 * 1024 * 1024) {
      alert('文件大小不能超过 2MB（本地存储限制）')
      if (bgImageInputRef.value) bgImageInputRef.value.value = ''
      return
    }
    
    bgUploading.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      bgPreview.imageUrl = e.target?.result as string
      bgUploading.value = false
    }
    reader.onerror = () => {
      alert('读取文件失败')
      bgUploading.value = false
    }
    reader.readAsDataURL(file)
    
    if (bgImageInputRef.value) {
      bgImageInputRef.value.value = ''
    }
  }

  function applyBgSettings() {
    const bgLayer = document.getElementById('bg-layer')
    if (bgLayer) {
      if (bgSettings.enabled && bgSettings.imageUrl) {
        bgLayer.style.backgroundImage = `url(${bgSettings.imageUrl})`
        bgLayer.style.opacity = String(bgSettings.opacity)
        bgLayer.style.filter = `blur(${bgSettings.blur}px)`
        bgLayer.style.display = 'block'
      } else {
        bgLayer.style.display = 'none'
      }
    }
  }

  function saveBgSettings() {
    Object.assign(bgSettings, bgPreview)
    const plain = {
      enabled: bgSettings.enabled,
      imageUrl: bgSettings.imageUrl,
      opacity: bgSettings.opacity,
      blur: bgSettings.blur,
    }
    localStorage.setItem('bgSettings', JSON.stringify(plain))
    showBgSettingsModal.value = false
    applyBgSettings()
  }

  function resetBgSettings() {
    bgPreview.enabled = false
    bgPreview.imageUrl = ''
    bgPreview.opacity = 0.5
    bgPreview.blur = 0
  }

  function loadBgSettings() {
    const saved = localStorage.getItem('bgSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        bgSettings.enabled = parsed.enabled === true
        bgSettings.imageUrl = parsed.imageUrl || ''
        bgSettings.opacity = typeof parsed.opacity === 'number' ? parsed.opacity : 0.5
        bgSettings.blur = typeof parsed.blur === 'number' ? parsed.blur : 0
        applyBgSettings()
      } catch {}
    }
  }

  return {
    showBgSettingsModal,
    bgSettings,
    bgPreview,
    bgImageInputRef,
    bgUploading,
    openBgSettings,
    handleBgImageUpload,
    saveBgSettings,
    resetBgSettings,
    loadBgSettings,
  }
}

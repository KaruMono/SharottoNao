export interface SearchSuggestion {
  id: number
  title: string
  coverImage: string | null
}

export interface ImageSearchResult {
  id: number
  title: string
  coverImage: string | null
  similarity: number
}

type AnimeTraceCharacter = {
  work?: string
}

type AnimeTraceItem = {
  character?: AnimeTraceCharacter[]
}

type AnimeTraceResponse = {
  code?: number
  data?: AnimeTraceItem[]
}

type SearchGameResult = {
  id: number
  title: string
  coverImage: string | null
}

export function useSearchModal() {
  const router = useRouter()

  const searchQuery = ref('')
  const searchType = ref<'game' | 'company' | 'image'>('game')
  const showSearchModal = ref(false)
  const searchInputRef = ref<HTMLInputElement | null>(null)
  const hotSearches = ref<string[]>([])
  const searchSuggestions = ref<SearchSuggestion[]>([])
  const searchHistory = ref<string[]>([])
  const imageSearchResults = ref<ImageSearchResult[]>([])
  const imageRecognizedGames = ref<string[]>([])
  const imageSearching = ref(false)
  const imagePreview = ref('')
  const imageSearchError = ref('')
  const imageInputRef = ref<HTMLInputElement>()
  const trendingGames = ref<any[]>([])
  const showTrendingPanel = ref(false)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // 搜索执行
  async function handleSearch() {
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.trim()

      // 检测 VNDB ID（如 v12345）或 Bangumi ID（如 bg12345）
      const vndbMatch = query.match(/^v(\d+)$/i)
      const bangumiMatch = query.match(/^bg(\d+)$/i)

      if (vndbMatch || bangumiMatch) {
        try {
          const params = vndbMatch
            ? { vndbId: query.toLowerCase() }
            : { bangumiId: bangumiMatch![1] }
          const result = await $fetch<{ id: number }>('/api/games/lookup', { params })
          searchQuery.value = ''
          showSearchModal.value = false
          router.push(`/games/${result.id}`)
          return
        } catch {
          // 未找到，继续走普通搜索
        }
      }

      // 保存到搜索历史
      addToSearchHistory(query)

      const encodedQuery = encodeURIComponent(query)
      if (searchType.value === 'game') {
        router.push(`/search?q=${encodedQuery}&type=games`)
      } else {
        router.push(`/search?q=${encodedQuery}&type=companies`)
      }
      searchQuery.value = ''
      showSearchModal.value = false
    }
  }

  function handleHotSearch(term: string) {
    searchQuery.value = term
    searchSuggestions.value = []
    handleSearch()
  }

  function handleHistorySearch(term: string) {
    searchQuery.value = term
    searchSuggestions.value = []
    handleSearch()
  }

  // 搜索历史管理
  function loadSearchHistory() {
    try {
      const saved = localStorage.getItem('searchHistory')
      if (saved) {
        searchHistory.value = JSON.parse(saved)
      }
    } catch {
      searchHistory.value = []
    }
  }

  function addToSearchHistory(term: string) {
    const MAX_TERM_LENGTH = 50
    if (term.length > MAX_TERM_LENGTH) {
      term = term.slice(0, MAX_TERM_LENGTH)
    }
    const index = searchHistory.value.indexOf(term)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
    }
    searchHistory.value.unshift(term)
    if (searchHistory.value.length > 10) {
      searchHistory.value = searchHistory.value.slice(0, 10)
    }
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
  }

  function removeHistoryItem(index: number) {
    searchHistory.value.splice(index, 1)
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
  }

  function clearSearchHistory() {
    searchHistory.value = []
    localStorage.removeItem('searchHistory')
  }

  // 搜索自动补全
  function handleSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    
    const q = searchQuery.value.trim()
    if (q.length < 2) {
      searchSuggestions.value = []
      return
    }

    searchDebounceTimer = setTimeout(async () => {
      try {
        const data = await $fetch<any[]>('/api/search/suggestions', {
          params: { q, limit: 5 },
        })
        searchSuggestions.value = data
      } catch {
        searchSuggestions.value = []
      }
    }, 300)
  }

  // 加载热门搜索
  async function loadHotSearches() {
    try {
      const data = await $fetch<{ items: string[] }>('/api/hot-searches')
      hotSearches.value = data.items || []
    } catch {
      hotSearches.value = []
    }
  }

  // 图片搜索相关
  function triggerImageInput() {
    imageInputRef.value?.click()
  }

  function handleImageDrop(e: DragEvent) {
    const file = e.dataTransfer?.files[0]
    if (file) processImageFile(file)
  }

  function handleImageSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) processImageFile(file)
    if (imageInputRef.value) imageInputRef.value.value = ''
  }

  async function processImageFile(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      imageSearchError.value = '不支持的图片格式，请使用 JPG、PNG、GIF 或 WebP'
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      imageSearchError.value = '图片大小不能超过 10MB'
      return
    }

    imageSearchError.value = ''
    imageSearchResults.value = []
    imageRecognizedGames.value = []
    
    // 显示预览
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)

    // 转换为 Base64 并搜索
    imageSearching.value = true
    try {
      const base64 = await fileToBase64(file)
      console.log('开始识别图片，大小:', (file.size / 1024).toFixed(2), 'KB')
      
      const { authFetch: authFetchImage } = useAuthRequest()
      const result = await authFetchImage<AnimeTraceResponse>('/api/animetrace/search', {
        method: 'POST',
        body: {
          file: base64.split(',')[1],
          model: 'animetrace_high_beta',
        },
      })

      console.log('识别结果:', result)

      if (result.code === 0 && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const gameNames = new Set<string>()
        
        result.data.forEach((item) => {
          if (item.character && Array.isArray(item.character)) {
            item.character.forEach((char) => {
              if (char.work) {
                gameNames.add(char.work)
              }
            })
          }
        })
        
        const uniqueGameNames = Array.from(gameNames)
        console.log('识别到的游戏名称:', uniqueGameNames)
        
        if (uniqueGameNames.length > 0) {
          imageRecognizedGames.value = uniqueGameNames
          
          const searchResults = await Promise.all(
            uniqueGameNames.slice(0, 5).map(async (name: string) => {
              try {
                const games = await $fetch<{ items: SearchGameResult[] }>('/api/games', {
                  params: { search: name, limit: 1 },
                })
                return games.items[0]
              } catch {
                return null
              }
            })
          )
          
          imageSearchResults.value = searchResults
            .filter((game): game is SearchGameResult => Boolean(game))
            .map((game, index) => ({
              id: game.id,
              title: game.title,
              coverImage: game.coverImage,
              similarity: Math.round((100 - index * 10)),
            }))
        } else {
          imageSearchError.value = '未识别到游戏信息，请尝试使用更清晰的游戏截图'
        }
      } else {
        imageSearchError.value = '未识别到游戏信息，请尝试使用游戏封面或角色立绘'
      }
    } catch (err: any) {
      console.error('图片识别失败:', err)
      const errorMsg = err.data?.message || err.message || '识别失败，请重试'
      imageSearchError.value = errorMsg
    } finally {
      imageSearching.value = false
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 加载本月热门游戏（带缓存）
  let trendingLoadedAt = 0
  async function loadTrendingGames() {
    // 5 分钟内复用缓存
    if (trendingGames.value.length > 0 && Date.now() - trendingLoadedAt < 5 * 60 * 1000) return
    try {
      const data = await $fetch<any[]>('/api/trending/monthly', {
        params: { limit: 5 },
      })
      trendingGames.value = data || []
      trendingLoadedAt = Date.now()
    } catch (err) {
      console.error('加载本月热门游戏失败:', err)
      trendingGames.value = []
    }
  }

  // 格式化浏览量
  function formatViewCount(count: number): string {
    if (count >= 10000) {
      return (count / 10000).toFixed(1) + 'w'
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k'
    }
    return count.toString()
  }

  // 监听搜索弹窗打开
  watch(showSearchModal, (val) => {
    if (val) {
      loadTrendingGames()
      nextTick(() => {
        if (searchType.value !== 'image') {
          searchInputRef.value?.focus()
        }
      })
    } else {
      imagePreview.value = ''
      imageSearchResults.value = []
      imageRecognizedGames.value = []
      imageSearchError.value = ''
    }
  })

  // 键盘快捷键关闭搜索弹窗
  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showSearchModal.value) {
      showSearchModal.value = false
    }
  }

  function initSearchListeners() {
    document.addEventListener('keydown', handleSearchKeydown)
    loadHotSearches()
    loadSearchHistory()
  }

  function cleanupSearchListeners() {
    document.removeEventListener('keydown', handleSearchKeydown)
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
  }

  return {
    searchQuery,
    searchType,
    showSearchModal,
    searchInputRef,
    hotSearches,
    searchSuggestions,
    searchHistory,
    imageSearchResults,
    imageRecognizedGames,
    imageSearching,
    imagePreview,
    imageSearchError,
    imageInputRef,
    trendingGames,
    showTrendingPanel,
    handleSearch,
    handleHotSearch,
    handleHistorySearch,
    handleSearchInput,
    removeHistoryItem,
    clearSearchHistory,
    triggerImageInput,
    handleImageDrop,
    handleImageSelect,
    formatViewCount,
    initSearchListeners,
    cleanupSearchListeners,
  }
}

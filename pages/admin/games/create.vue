<template>
  <div class="pb-20">
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink to="/admin/games" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <Icon name="fa6-solid:arrow-left" />
      </NuxtLink>
      <h1 class="text-2xl font-bold">创建游戏条目（管理员）</h1>
    </div>

    <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-6 text-sm text-yellow-700 dark:text-yellow-300">
      <Icon name="fa6-solid:shield-halved" class="mr-2" />
      管理员创建模式：可以创建不在 VNDB 或 Bangumi 的游戏条目，并设置开发商、标签等信息。
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- 外部平台关联（可选） -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">外部平台关联（可选）</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">VNDB ID</label>
            <div class="flex gap-2">
              <input 
                v-model="vndbId"
                type="text" 
                class="admin-input flex-1"
                placeholder="如：v27448"
              />
              <AdminKumoButton variant="primary"
                type="button"
                @click="fetchVNDBData"
                :disabled="fetchingVndb || !vndbId"
              >
                <Icon name="fa6-solid:spinner" v-if="fetchingVndb" />
                <Icon name="fa6-solid:cloud-arrow-down" v-else />
              </AdminKumoButton>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Bangumi ID</label>
            <input 
              v-model="bangumiId"
              type="text" 
              class="admin-input w-full"
              placeholder="如：297264"
            />
          </div>
        </div>

        <div v-if="vndbError" class="text-sm text-red-500">
          <Icon name="fa6-solid:circle-exclamation" class="mr-1" />{{ vndbError }}
        </div>
        <div v-if="vndbFetched" class="text-sm text-green-600 dark:text-green-400">
          <Icon name="fa6-solid:circle-check" class="mr-1" />已从 VNDB 获取数据
        </div>
      </div>

      <!-- 封面图片 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">封面图片 *</h2>
        <div class="flex gap-6">
          <div class="w-40 flex-shrink-0">
            <div 
              class="aspect-[3/4] rounded-lg border-2 border-dashed dark:border-zinc-600 overflow-hidden bg-gray-50 dark:bg-zinc-700 flex items-center justify-center"
              :class="{ 'border-gray-300': !form.coverImage, 'border-transparent': form.coverImage }"
            >
              <img 
                v-if="form.coverImage" 
                :src="form.coverImage" 
                class="w-full h-full object-cover"
              />
              <div v-else class="text-center text-gray-400 p-4">
                <Icon name="fa6-solid:image" class="text-3xl mb-2" />
                <p class="text-xs">封面预览</p>
              </div>
            </div>
          </div>
          <div class="flex-1 space-y-4">
            <div 
              class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition hover:border-gray-400 dark:hover:border-zinc-500"
              :class="uploading ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-zinc-600'"
              @click="triggerFileInput"
              @dragover.prevent
              @drop.prevent="handleDrop"
            >
              <input 
                ref="fileInputRef"
                type="file" 
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                class="hidden"
                @change="handleFileSelect"
              />
              <div v-if="uploading" class="text-blue-600 dark:text-blue-400">
                <Icon name="fa6-solid:spinner" class="fa-spin text-2xl mb-2" />
                <p>上传中...</p>
              </div>
              <div v-else>
                <Icon name="fa6-solid:cloud-arrow-up" class="text-2xl text-gray-400 mb-2" />
                <p class="text-sm text-gray-600 dark:text-gray-400">点击或拖拽图片到此处上传</p>
                <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
              </div>
            </div>
            <div v-if="uploadError" class="text-sm text-red-500">
              <Icon name="fa6-solid:circle-exclamation" class="mr-1" />{{ uploadError }}
            </div>
          </div>
        </div>
      </div>

      <!-- 多语言标题 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">
          游戏标题 *
          <span class="text-sm font-normal text-gray-500 ml-2">（至少填写一个语言）</span>
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-5 h-5 rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-bold">JP</span>
                日文标题
              </span>
            </label>
            <input 
              v-model="form.titleJa"
              type="text" 
              class="admin-input w-full"
              placeholder="如：クラナド"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">EN</span>
                英文标题
              </span>
            </label>
            <input 
              v-model="form.titleEn"
              type="text" 
              class="admin-input w-full"
              placeholder="如：CLANNAD"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-5 h-5 rounded bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-xs flex items-center justify-center font-bold">简</span>
                简体中文标题
              </span>
            </label>
            <input 
              v-model="form.titleZhHans"
              type="text" 
              class="admin-input w-full"
              placeholder="如：团子大家族"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-xs flex items-center justify-center font-bold">繁</span>
                繁体中文标题
              </span>
            </label>
            <input 
              v-model="form.titleZhHant"
              type="text" 
              class="admin-input w-full"
              placeholder="如：團子大家族"
            />
          </div>
        </div>
      </div>

      <!-- 多语言简介 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">
          游戏简介 *
          <span class="text-sm font-normal text-gray-500 ml-2">（至少填写一个语言）</span>
        </h2>
        <div class="overflow-x-auto border-b dark:border-zinc-700">
          <div ref="descTabsRef" class="relative flex w-max">
            <span
              aria-hidden="true"
              class="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-gray-800 dark:bg-white transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
              :style="descIndicatorStyle"
            />
            <button
              v-for="lang in descriptionLangs"
              :key="lang.key"
              type="button"
              @click="activeDescLang = lang.key"
              :aria-pressed="activeDescLang === lang.key"
              class="shrink-0 px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors duration-200 motion-reduce:transition-none whitespace-nowrap"
              :class="activeDescLang === lang.key
                ? 'text-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="w-5 h-5 rounded text-xs flex items-center justify-center font-bold"
                  :class="lang.badgeClass"
                >{{ lang.badge }}</span>
                {{ lang.label }}
                <Icon name="fa6-solid:check" class="text-green-500 text-xs" v-if="form[lang.key as keyof typeof form]" />
              </span>
            </button>
          </div>
        </div>
        <div class="grid pt-2">
          <Transition
            v-for="lang in descriptionLangs"
            :key="lang.key"
            enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
            enter-from-class="opacity-0 translate-x-2 motion-reduce:transform-none"
            leave-active-class="transition-[opacity,transform] duration-150 ease-in pointer-events-none motion-reduce:transition-none"
            leave-to-class="opacity-0 -translate-x-2 motion-reduce:transform-none"
          >
            <textarea
              v-show="activeDescLang === lang.key"
              v-model="form[lang.key]"
              :inert="activeDescLang !== lang.key"
              :aria-hidden="activeDescLang !== lang.key"
              :aria-label="`${lang.label}游戏简介`"
              class="admin-textarea col-start-1 row-start-1 w-full"
              rows="6"
              :placeholder="lang.placeholder"
            ></textarea>
          </Transition>
        </div>
      </div>

      <!-- 其他信息 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">其他信息</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">发售日期</label>
            <input 
              v-model="form.releaseDate"
              type="date" 
              class="admin-input w-full"
            />
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-2">开发商/发行商</label>
            <!-- 已选择的会社 -->
            <div v-if="selectedCompanies.length" class="flex flex-wrap gap-2 mb-3">
              <div 
                v-for="(sc, index) in selectedCompanies" :key="sc.companyId"
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 rounded-lg"
              >
                <AdminSelect aria-label="会社角色"
                  v-model="sc.role"
                >
                  <option value="DEVELOPER">开发商</option>
                  <option value="PUBLISHER">发行商</option>
                </AdminSelect>
                <span class="text-sm font-medium">{{ sc.name }}</span>
                <button type="button" @click="removeCompany(index)" class="text-gray-400 hover:text-red-500">
                  <Icon name="fa6-solid:xmark" class="text-xs" />
                </button>
              </div>
            </div>
            <!-- 搜索添加会社 -->
            <div class="relative">
              <input 
                v-model="companySearch"
                type="text" 
                class="admin-input w-full"
                placeholder="搜索会社名称或别名..."
                @focus="showCompanyDropdown = true"
                @input="searchCompanies"
              />
              <Icon name="fa6-solid:magnifying-glass" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <div 
                v-if="showCompanyDropdown && companyResults.length"
                class="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-60 overflow-auto"
              >
                <button 
                  v-for="company in companyResults" :key="company.id"
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-zinc-600 text-sm flex items-center justify-between"
                  :class="{ 'opacity-50': isCompanySelected(company.id) }"
                  :disabled="isCompanySelected(company.id)"
                  @click="addCompany(company)"
                >
                  <div>
                    <span class="font-medium">{{ company.name }}</span>
                    <span v-if="company.nameOriginal" class="text-gray-500 ml-2">{{ company.nameOriginal }}</span>
                    <div v-if="company.aliases?.length" class="text-xs text-gray-400">
                      别名: {{ company.aliases.slice(0, 3).join(', ') }}
                    </div>
                  </div>
                  <Icon name="fa6-solid:check" class="text-green-500" v-if="isCompanySelected(company.id)" />
                </button>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">可添加多个开发商/发行商，支持按名称和别名搜索</p>
          </div>

          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-2">别名（每行一个）</label>
            <textarea 
              v-model="aliasesText"
              class="admin-textarea w-full"
              rows="3"
              placeholder="其他名称或别名..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">标签</h2>
        <TagAutocomplete v-model="selectedTags" admin appearance="admin" />
      </div>

      <!-- 设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow space-y-5">
        <h2 class="font-semibold text-lg border-b pb-3 dark:border-zinc-700">设置</h2>
        <label class="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox" 
            v-model="form.isNsfw"
            class="w-5 h-5 rounded border-gray-300 dark:border-zinc-600"
          />
          <div>
            <span class="font-medium">NSFW 内容</span>
            <p class="text-sm text-gray-500">标记此条目为成人内容（NSFW）</p>
          </div>
        </label>
      </div>

    </form>

    <!-- 底部固定操作栏 -->
    <div class="fixed bottom-0 right-0 lg:left-56 left-0 z-30 px-6 py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-3">
      <AdminKumoButton variant="secondary"
        to="/admin/games"
      >
        取消
      </AdminKumoButton>
      <AdminKumoButton variant="primary"
        :disabled="loading || !canSubmit"
        @click="handleSubmit"
      >
        {{ loading ? '创建中...' : '创建条目' }}
      </AdminKumoButton>
    </div>

    <!-- 封面裁剪器 -->
    <ImageCropper
      v-model="coverCropperOpen"
      :image-file="coverCropFile"
      :aspect-ratio="0.75"
      :output-width="600"
      @cropped="handleCoverCropped"
    />
  </div>
</template>

<script setup lang="ts">
import { useTabIndicator } from '~/composables/useTabIndicator'
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()

const selectedTags = ref<Array<{ id: number; name: string; color?: string | null }>>([])

// 会社搜索
const companySearch = ref('')
const showCompanyDropdown = ref(false)
const companyResults = ref<any[]>([])
const selectedCompanies = ref<{ companyId: number; name: string; role: 'DEVELOPER' | 'PUBLISHER' }[]>([])
const vndbAutoCompanies = ref<Array<{ name: string; nameOriginal: string | null }>>([])
let companySearchTimer: ReturnType<typeof setTimeout>

function searchCompanies() {
  showCompanyDropdown.value = true
  clearTimeout(companySearchTimer)
  const q = companySearch.value.trim()
  if (!q) {
    companyResults.value = []
    return
  }
  companySearchTimer = setTimeout(async () => {
    try {
      const data: any = await $fetch('/api/companies', { query: { search: q, limit: 20 } } as any)
      companyResults.value = data.items || []
    } catch {
      companyResults.value = []
    }
  }, 300)
}

function isCompanySelected(companyId: number) {
  return selectedCompanies.value.some(c => c.companyId === companyId)
}

function addCompany(company: any) {
  if (isCompanySelected(company.id)) return
  selectedCompanies.value.push({
    companyId: company.id,
    name: company.name,
    role: 'DEVELOPER',
  })
  companySearch.value = ''
  companyResults.value = []
  showCompanyDropdown.value = false
}

function removeCompany(index: number) {
  selectedCompanies.value.splice(index, 1)
}

// 外部平台 ID
const vndbId = ref('')
const bangumiId = ref('')
const fetchingVndb = ref(false)
const vndbError = ref('')
const vndbFetched = ref(false)

// 图片上传
const fileInputRef = ref<HTMLInputElement>()
const uploading = ref(false)
const uploadError = ref('')
const coverCropperOpen = ref(false)
const coverCropFile = ref<File | null>(null)

// 简介语言切换
const activeDescLang = ref<'descriptionEn' | 'descriptionJa' | 'descriptionZhHans' | 'descriptionZhHant'>('descriptionEn')
const { tabContainer: descTabsRef, indicatorStyle: descIndicatorStyle } = useTabIndicator(activeDescLang)
const descriptionLangs: Array<{
  key: typeof activeDescLang.value
  label: string
  badge: string
  badgeClass: string
  placeholder: string
}> = [
  { key: 'descriptionEn', label: '英文', badge: 'EN', badgeClass: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400', placeholder: 'English description...' },
  { key: 'descriptionJa', label: '日文', badge: 'JP', badgeClass: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400', placeholder: '日本語の説明...' },
  { key: 'descriptionZhHans', label: '简体中文', badge: '简', badgeClass: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400', placeholder: '简体中文简介...' },
  { key: 'descriptionZhHant', label: '繁体中文', badge: '繁', badgeClass: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400', placeholder: '繁體中文簡介...' },
]

// 表单数据
const form = reactive({
  titleEn: '',
  titleJa: '',
  titleZhHans: '',
  titleZhHant: '',
  descriptionEn: '',
  descriptionJa: '',
  descriptionZhHans: '',
  descriptionZhHant: '',
  coverImage: '',
  releaseDate: '',
  isNsfw: false,
})

const aliasesText = ref('')
const loading = ref(false)

// 是否可以提交
const canSubmit = computed(() => {
  // 必须有封面
  if (!form.coverImage) return false
  // 必须有至少一个标题
  if (!form.titleEn && !form.titleJa && !form.titleZhHans && !form.titleZhHant) return false
  // 必须有至少一个简介
  if (!form.descriptionEn && !form.descriptionJa && !form.descriptionZhHans && !form.descriptionZhHant) return false
  return true
})

// 触发文件选择
function triggerFileInput() {
  fileInputRef.value?.click()
}

// 处理文件选择
async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    openCoverCropper(input.files[0])
  }
  if (input) input.value = ''
}

// 处理拖放
async function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) {
    openCoverCropper(file)
  }
}

function openCoverCropper(file: File) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    uploadError.value = '只支持 JPG、PNG、GIF、WebP 格式的图片'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    uploadError.value = '文件大小不能超过 10MB'
    return
  }
  uploadError.value = ''
  coverCropFile.value = file
  coverCropperOpen.value = true
}

async function handleCoverCropped(blob: Blob) {
  uploading.value = true
  uploadError.value = ''
  try {
    const formData = new FormData()
    formData.append('file', blob, 'cover.webp')
    formData.append('folder', 'covers')
    
    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })
    
    form.coverImage = result.url
  } catch (error: any) {
    uploadError.value = error.data?.message || '上传失败'
  } finally {
    uploading.value = false
    coverCropFile.value = null
  }
}

// 从 VNDB 获取数据
async function fetchVNDBData() {
  const rawId = vndbId.value.trim().toLowerCase()
  
  const urlMatch = rawId.match(/vndb\.org\/(v\d+)/)
  const id = urlMatch ? urlMatch[1] : rawId
  
  if (!id || !/^v\d+$/.test(id)) {
    vndbError.value = 'VNDB ID 格式错误'
    return
  }
  
  vndbId.value = id
  vndbError.value = ''
  fetchingVndb.value = true
  vndbFetched.value = false
  
  try {
    const data: any = await ($fetch as any)(`/api/vndb/${id}`)

    form.titleEn = data.titleEn || ''
    form.titleJa = data.titleJa || ''
    form.titleZhHans = data.titleZhHans || ''
    form.titleZhHant = data.titleZhHant || ''
    form.descriptionEn = data.descriptionEn || ''
    form.isNsfw = data.isNsfw

    if (data.released) {
      const parts = data.released.split('-')
      if (parts.length >= 3) {
        form.releaseDate = data.released
      } else if (parts.length === 2) {
        form.releaseDate = `${parts[0]}-${parts[1]}-01`
      } else if (parts.length === 1 && parts[0].length === 4) {
        form.releaseDate = `${parts[0]}-01-01`
      }
    }

    aliasesText.value = data.aliases.join('\n')

    // 保存从 VNDB 获取的厂商信息（不显示在前端界面）
    if (data.developers && Array.isArray(data.developers)) {
      vndbAutoCompanies.value = data.developers
    }

    // 自动下载 VNDB 封面图到本地
    if (data.coverImage && !form.coverImage) {
      try {
        uploading.value = true
        const imgResult = await authFetch<{ url: string }>('/api/upload/from-url', {
          method: 'POST',
          body: { url: data.coverImage, folder: 'covers' },
        })
        form.coverImage = imgResult.url
      } catch {
        // 封面下载失败不阻断流程
        uploadError.value = 'VNDB 封面下载失败，请手动上传'
      } finally {
        uploading.value = false
      }
    }

    vndbFetched.value = true
  } catch (error: any) {
    vndbError.value = error.data?.statusMessage
      || error.statusMessage
      || error.data?.message
      || '获取 VNDB 数据失败'
  } finally {
    fetchingVndb.value = false
  }
}

// 提交表单
async function handleSubmit() {
  if (!canSubmit.value) return

  loading.value = true
  try {
    const aliases = aliasesText.value
      .split('\n')
      .map(a => a.trim())
      .filter(Boolean)

    const result = await authFetch<{ id: number }>('/api/games', {
      method: 'POST',
      body: {
        titleEn: form.titleEn || undefined,
        titleJa: form.titleJa || undefined,
        titleZhHans: form.titleZhHans || undefined,
        titleZhHant: form.titleZhHant || undefined,
        aliases,
        descriptionEn: form.descriptionEn || undefined,
        descriptionJa: form.descriptionJa || undefined,
        descriptionZhHans: form.descriptionZhHans || undefined,
        descriptionZhHant: form.descriptionZhHant || undefined,
        coverImage: form.coverImage,
        releaseDate: form.releaseDate || undefined,
        companies: selectedCompanies.value.length > 0
          ? selectedCompanies.value.map(c => ({ companyId: c.companyId, role: c.role }))
          : undefined,
        tagIds: selectedTags.value.map(tag => tag.id),
        isNsfw: form.isNsfw,
        vndbId: vndbId.value || undefined,
        bangumiId: bangumiId.value ? parseInt(bangumiId.value) : undefined,
        skipExternalId: true, // 管理员跳过外部 ID 验证
        // 传递从 VNDB 自动获取的厂商信息（后端会自动匹配）
        vndbDevelopers: vndbAutoCompanies.value.length > 0 ? vndbAutoCompanies.value : undefined,
      },
    })
    toast.success('创建成功')
    router.push(`/games/${result.id}`)
  } catch (error: any) {
    toast.error(error.data?.message || '创建失败')
  } finally {
    loading.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `创建游戏条目 - ${siteName.value} 管理后台`),
})
</script>

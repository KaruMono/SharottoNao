<template>
  <div class="max-w-3xl mx-auto px-2.5 sm:px-4 md:px-6 pb-28 md:pb-24">
    <div class="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
      <NuxtLink :to="`/games/${gameId}`" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <Icon name="fa6-solid:arrow-left" />
      </NuxtLink>
      <h1 class="text-xl sm:text-2xl font-bold truncate">编辑游戏条目</h1>
    </div>

    <div v-if="pending" class="text-center py-16">
      <Icon name="fa6-solid:spinner" class="fa-spin text-2xl" />
      <p class="mt-2 text-gray-500">加载中...</p>
    </div>

    <div v-else-if="error" class="text-center py-16">
      <Icon name="fa6-solid:circle-exclamation" class="text-4xl text-red-500 mb-4" />
      <p class="text-gray-500">{{ (error as any).data?.message || '加载失败' }}</p>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-4 sm:space-y-6">
      <!-- 外部平台关联 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">外部平台关联</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">VNDB ID</label>
            <template v-if="isAdmin || !gameData?.vndbId">
              <input 
                v-model="form.vndbId"
                type="text" 
                class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="如：v27448"
              />
            </template>
            <template v-else>
              <div class="w-full px-4 py-2.5 rounded-lg border bg-gray-100 dark:bg-zinc-700/50 dark:border-zinc-600 text-gray-500">
                {{ form.vndbId }}
                <span class="text-xs ml-2">(已锁定，不允许修改)</span>
              </div>
            </template>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Bangumi ID</label>
            <input 
              v-model="form.bangumiId"
              type="text" 
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="如：297264"
            />
          </div>
        </div>
      </div>

      <!-- 封面图片 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">封面图片 *</h2>
        
        <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div class="w-32 sm:w-40 flex-shrink-0 mx-auto sm:mx-0">
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
              class="border-2 border-dashed rounded-lg p-3.5 sm:p-6 text-center cursor-pointer transition hover:border-gray-400 dark:hover:border-zinc-500"
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
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">
          游戏标题 *
          <span class="block sm:inline text-sm font-normal text-gray-500 sm:ml-2 mt-1 sm:mt-0">（至少填写一个语言）</span>
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
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="如：團子大家族"
            />
          </div>
        </div>
      </div>

      <!-- 多语言简介 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">
          游戏简介 *
          <span class="block sm:inline text-sm font-normal text-gray-500 sm:ml-2 mt-1 sm:mt-0">（至少填写一个语言）</span>
        </h2>
        
        <div class="flex overflow-x-auto border-b dark:border-zinc-700 -mx-3.5 sm:mx-0 px-3.5 sm:px-0">
          <button 
            v-for="lang in descriptionLangs" 
            :key="lang.key"
            type="button"
            @click="activeDescLang = lang.key"
            class="shrink-0 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap"
            :class="activeDescLang === lang.key 
              ? 'border-gray-800 dark:border-white text-gray-800 dark:text-white' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
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
        
        <div class="pt-2">
          <textarea 
            v-model="(form as any)[activeDescLang]"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows="6"
            :placeholder="descriptionLangs.find(l => l.key === activeDescLang)?.placeholder"
          ></textarea>
        </div>
      </div>

      <!-- 其他信息 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">其他信息</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium mb-2">发售日期</label>
            <input 
              v-model="form.releaseDate"
              type="date" 
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                <select 
                  v-model="sc.role" 
                  class="text-xs bg-transparent border-none focus:outline-none cursor-pointer dark:text-gray-200"
                >
                  <option value="DEVELOPER">开发商</option>
                  <option value="PUBLISHER">发行商</option>
                </select>
                <span class="text-sm font-medium">{{ sc.name }}</span>
                <button type="button" @click="removeCompany(index)" class="text-gray-400 hover:text-red-500">
                  <Icon name="fa6-solid:xmark" class="text-xs" />
                </button>
              </div>
            </div>
            
            <!-- 搜索添加会社 -->
            <div class="relative" ref="companyDropdownRef">
              <input 
                v-model="companySearch"
                type="text" 
                class="w-full px-4 py-2.5 pl-10 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="搜索会社名称或别名..."
                @focus="showCompanyDropdown = true"
                @input="searchCompanies"
              />
              <Icon name="fa6-solid:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              
              <!-- 下拉列表 -->
              <div 
                v-if="showCompanyDropdown && filteredCompanies.length"
                class="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-60 overflow-auto"
              >
                <button 
                  v-for="company in filteredCompanies" :key="company.id"
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
              class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              rows="3"
              placeholder="其他名称或别名..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 相关链接 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700">
          <h2 class="font-semibold text-base sm:text-lg">相关链接</h2>
          <button type="button" @click="addPurchaseLink" class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500">
            <Icon name="fa6-solid:plus" class="mr-1" />添加
          </button>
        </div>
        
        <div v-if="purchaseLinks.length" class="space-y-3">
          <div v-for="(link, index) in purchaseLinks" :key="link._key" class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <input 
              v-model="link.name"
              type="text" 
              class="w-full sm:w-32 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="平台名称"
            />
            <input 
              v-model="link.url"
              type="url" 
              class="w-full sm:flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="https://..."
            />
            <button type="button" @click="removePurchaseLink(index)" class="self-end sm:self-auto p-2 text-red-500 hover:text-red-600 transition">
              <Icon name="fa6-solid:trash" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">暂无相关链接</p>
        <p class="text-xs text-gray-500">常见平台：Steam、DLsite、Getchu、DMM、官网等</p>
      </div>

      <!-- 制作人员编辑 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700">
          <h2 class="font-semibold text-base sm:text-lg">制作人员</h2>
          <button 
            type="button" 
            @click="addStaff" 
            class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
          >
            <Icon name="fa6-solid:plus" class="mr-1" />添加
          </button>
        </div>
        
        <div v-if="staffList.length" class="space-y-3">
          <div v-for="(staff, index) in staffList" :key="staff._key" class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-center gap-2 sm:gap-3">
            <input 
              v-model="staff.name"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="姓名"
            />
            <input 
              v-model="staff.nameOriginal"
              type="text" 
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
              placeholder="原名（可选）"
            />
            <select 
              v-model="staff.role"
              class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
            >
              <option value="ARTIST">原画</option>
              <option value="WRITER">剧本</option>
              <option value="COMPOSER">音乐</option>
              <option value="VOICE_ACTOR">声优</option>
              <option value="DIRECTOR">导演</option>
              <option value="OTHER">其他</option>
            </select>
            <button 
              type="button" 
              @click="removeStaff(index)" 
              class="justify-self-end sm:justify-self-auto p-2 text-red-500 hover:text-red-600 transition"
            >
              <Icon name="fa6-solid:trash" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">暂无制作人员信息</p>
      </div>

      <!-- 标签 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">标签</h2>
        <TagAutocomplete
          v-model="selectedTags"
          v-model:pending-names="pendingNewTags"
          :admin="isAdmin"
          :creation-mode="isAdmin ? 'immediate' : 'proposal'"
        />
      </div>

      <!-- 设置 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">设置</h2>
        
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
    <div class="fixed bottom-0 left-0 right-0 z-30 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-gray-200 dark:border-zinc-700">
      <div class="max-w-3xl mx-auto grid grid-cols-2 sm:flex sm:justify-end gap-3">
        <NuxtLink 
          :to="`/games/${gameId}`"
          class="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-center hover:bg-gray-100 dark:hover:bg-zinc-700"
        >
          取消
        </NuxtLink>
        <button 
          :disabled="loading || !canSubmit"
          class="px-4 sm:px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
          @click="handleSubmit"
        >
          {{ loading ? '提交中...' : (isAdmin ? '保存修改' : '提交审核') }}
        </button>
      </div>
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
import type { AdminGameItem, CompanyItem, ListResponse, TagItem } from '~/types/api'
import { onClickOutside } from '@vueuse/core'

definePageMeta({
  middleware: 'require-auth',
})

const route = useRoute()
const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()
const { data: session } = useAuth()

const gameId = computed(() => parseInt(route.params.id as string))
const user = computed(() => session.value as any)
const isAdmin = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'EDITOR')

// 获取游戏数据
const { data: gameData, pending, error } = await useAuthFetch<AdminGameItem>(`/api/games/${gameId.value}`, {
  key: `game-edit-data-${gameId.value}`,
})

// 获取开发商列表
const { data: companiesData } = await (useFetch as any)('/api/companies', {
  key: 'game-edit-companies',
  query: { limit: 100 },
})

const companies = computed(() => companiesData.value?.items || [])

// 会社搜索相关
const companySearch = ref('')
const showCompanyDropdown = ref(false)
const filteredCompanies = ref<CompanyItem[]>([])
const selectedCompanies = ref<{ companyId: number; name: string; role: string }[]>([])
const companyDropdownRef = ref<HTMLElement | null>(null)
let companySearchTimer: ReturnType<typeof setTimeout>

const selectedTags = ref<TagItem[]>([])
// 玩家自由输入的新标签（词表里没有的），以虚线边框区分显示
const pendingNewTags = ref<string[]>([])

// 点击外部关闭下拉菜单
onClickOutside(companyDropdownRef, () => {
  showCompanyDropdown.value = false
})

// 会社搜索
function searchCompanies() {
  clearTimeout(companySearchTimer)
  const query = companySearch.value.trim().toLowerCase()
  
  if (!query) {
    filteredCompanies.value = []
    return
  }
  
  companySearchTimer = setTimeout(() => {
    filteredCompanies.value = companies.value.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(query)
      const originalMatch = c.nameOriginal?.toLowerCase().includes(query)
      const aliasMatch = c.aliases?.some((a: string) => a.toLowerCase().includes(query))
      return nameMatch || originalMatch || aliasMatch
    }).slice(0, 10)
  }, 200)
}

function isCompanySelected(companyId: number) {
  return selectedCompanies.value.some(c => c.companyId === companyId)
}

function addCompany(company: CompanyItem) {
  if (isCompanySelected(company.id)) return
  
  selectedCompanies.value.push({
    companyId: company.id,
    name: company.name,
    role: 'DEVELOPER',
  })
  
  companySearch.value = ''
  filteredCompanies.value = []
  showCompanyDropdown.value = false
}

function removeCompany(index: number) {
  selectedCompanies.value.splice(index, 1)
}

// 图片上传
const fileInputRef = ref<HTMLInputElement>()
const uploading = ref(false)
const uploadError = ref('')
const coverCropperOpen = ref(false)
const coverCropFile = ref<File | null>(null)

// 简介语言切换
const activeDescLang = ref('descriptionEn')
const descriptionLangs = [
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
  companyId: '' as number | '',
  isNsfw: false,
  vndbId: '',
  bangumiId: '',
})

const aliasesText = ref('')
// 行唯一 key（仅用于 v-for，提交前会剥离）
let rowKeySeed = 0
const purchaseLinks = ref<{ _key: number; name: string; url: string }[]>([])
const staffList = ref<{ _key: number; id?: number; name: string; nameOriginal: string; role: string }[]>([])
const loading = ref(false)

function addPurchaseLink() {
  purchaseLinks.value.push({ _key: ++rowKeySeed, name: '', url: '' })
}

function removePurchaseLink(index: number) {
  purchaseLinks.value.splice(index, 1)
}

function addStaff() {
  staffList.value.push({ _key: ++rowKeySeed, name: '', nameOriginal: '', role: 'ARTIST' })
}

function removeStaff(index: number) {
  staffList.value.splice(index, 1)
}

// 初始化表单数据
watch(gameData, (data) => {
  if (data) {
    form.titleEn = data.titleEn || ''
    form.titleJa = data.titleJa || ''
    form.titleZhHans = data.titleZhHans || ''
    form.titleZhHant = data.titleZhHant || ''
    form.descriptionEn = data.descriptionEn || ''
    form.descriptionJa = data.descriptionJa || ''
    form.descriptionZhHans = data.descriptionZhHans || ''
    form.descriptionZhHant = data.descriptionZhHant || ''
    form.coverImage = data.coverImage || ''
    form.releaseDate = data.releaseDate ? String(data.releaseDate).split('T')[0] : ''
    form.companyId = data.companyId || ''
    form.isNsfw = data.isNsfw || false
    form.vndbId = data.vndbId || ''
    form.bangumiId = data.bangumiId?.toString() || ''
    aliasesText.value = data.aliases?.join('\n') || ''
    
    // 初始化会社
    if (data.companies?.length) {
      selectedCompanies.value = data.companies.map(gc => {
        const company = 'company' in gc ? gc.company : undefined
        return {
          companyId: company?.id ?? ('companyId' in gc ? gc.companyId : 0) ?? 0,
          name: company?.name || ('name' in gc ? gc.name : '') || '',
          role: gc.role || 'DEVELOPER',
        }
      }).filter(c => c.companyId > 0 && c.name)
    }
    
    // 初始化标签（过滤掉"机器翻译"标签，普通用户不能手动编辑）
    if (data.tags?.length) {
      selectedTags.value = (data.tags as any[])
        .filter(t => !('sources' in t) || !Array.isArray(t.sources) || t.sources.includes('MANUAL'))
        .map<TagItem>(t => {
          const tag = 'tag' in t ? t.tag : undefined
          return {
            id: tag?.id ?? ('id' in t ? t.id : undefined) ?? ('tagId' in t ? t.tagId : undefined) ?? 0,
            name: tag?.name || ('name' in t ? t.name : '') || '',
            color: tag?.color || ('color' in t ? t.color : undefined),
          }
        })
        .filter(tag => tag.id > 0 && Boolean(tag.name) && tag.name !== '机器翻译')
    }
    
    // 初始化购买链接
    if (data.purchaseLinks?.length) {
      purchaseLinks.value = data.purchaseLinks.map(link => ({
        _key: ++rowKeySeed,
        name: link.name || '',
        url: link.url || '',
      }))
    }
    // 初始化STAFF
    if (data.staff?.length) {
      staffList.value = data.staff.map(s => ({
        _key: ++rowKeySeed,
        id: s.id,
        name: s.name || '',
        nameOriginal: s.nameOriginal || '',
        role: s.role || 'OTHER',
      }))
    }
  }
}, { immediate: true })

// 是否可以提交
const canSubmit = computed(() => {
  if (!form.coverImage) return false
  if (!form.titleEn && !form.titleJa && !form.titleZhHans && !form.titleZhHant) return false
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

// 提交表单
async function handleSubmit() {
  if (!canSubmit.value) return

  loading.value = true
  try {
    const aliases = aliasesText.value
      .split('\n')
      .map(a => a.trim())
      .filter(Boolean)

    // 过滤有效的购买链接（剥离 _key，避免污染提交数据）
    const validPurchaseLinks = purchaseLinks.value
      .filter(link => link.name && link.url)
      .map(link => ({ name: link.name, url: link.url }))

    // 过滤有效的STAFF（剥离 _key，避免污染提交数据）
    const validStaff = staffList.value
      .filter(s => s.name)
      .map(s => ({ id: s.id, name: s.name, nameOriginal: s.nameOriginal, role: s.role }))

    const submitData = {
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
      companies: selectedCompanies.value.map(c => ({
        companyId: c.companyId,
        role: c.role,
      })),
      tagIds: selectedTags.value.map(t => t.id),
      newTagNames: pendingNewTags.value.length > 0 ? pendingNewTags.value : undefined,
      isNsfw: form.isNsfw,
      vndbId: isAdmin.value || !gameData.value?.vndbId ? (form.vndbId || undefined) : undefined,
      bangumiId: form.bangumiId ? parseInt(form.bangumiId) : undefined,
      purchaseLinks: validPurchaseLinks.length > 0 ? validPurchaseLinks : [],
      staff: validStaff,
    }

    if (isAdmin.value) {
      // 管理员直接保存
      await authFetch(`/api/games/${gameId.value}`, {
        method: 'PUT',
        body: submitData,
      })
      toast.success('保存成功')
      router.push(`/games/${gameId.value}`)
    } else {
      // 普通用户提交审核请求
      await authFetch(`/api/games/${gameId.value}/edit-request`, {
        method: 'POST',
        body: submitData,
      })
      toast.success('修改已提交，等待管理员审核')
      router.push(`/games/${gameId.value}`)
    }
  } catch (error: any) {
    toast.error(error.data?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => gameData.value ? `编辑 ${gameData.value.title} - ${siteName.value}` : `编辑游戏 - ${siteName.value}`),
})
</script>

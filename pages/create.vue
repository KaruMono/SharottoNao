<template>
  <div class="max-w-3xl mx-auto px-2.5 sm:px-4 md:px-6 pb-28 md:pb-24">
    <h1 class="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">创建游戏条目</h1>

    <form @submit.prevent.stop="handleSubmit" class="space-y-4 sm:space-y-8">
      <!-- 外部平台关联（必填） -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">外部平台关联</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          请选择一个外部平台并输入对应的 ID，系统将自动获取游戏信息。
          <br>如需创建不在这两个平台的游戏，请联系管理员。
        </p>

        <!-- 平台选择 -->
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <label 
            class="flex-1 p-3.5 sm:p-4 rounded-lg border-2 cursor-pointer transition"
            :class="platform === 'vndb' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'"
          >
            <input type="radio" v-model="platform" value="vndb" class="hidden" />
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                V
              </div>
              <div>
                <div class="font-medium">VNDB</div>
                <div class="text-xs text-gray-500">The Visual Novel Database</div>
              </div>
            </div>
          </label>

          <label 
            class="flex-1 p-3.5 sm:p-4 rounded-lg border-2 cursor-pointer transition"
            :class="platform === 'bangumi' 
              ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' 
              : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'"
          >
            <input type="radio" v-model="platform" value="bangumi" class="hidden" />
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold">
                B
              </div>
              <div>
                <div class="font-medium">Bangumi</div>
                <div class="text-xs text-gray-500">番组计划（即将支持）</div>
              </div>
            </div>
          </label>
        </div>

        <!-- VNDB ID 输入 -->
        <div v-if="platform === 'vndb'" class="space-y-3">
          <label class="block text-sm font-medium">VNDB ID *</label>
          <div class="flex flex-col sm:flex-row gap-3">
            <input 
              v-model="vndbId"
              type="text" 
              class="flex-1 px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="如：v27448"
              @keyup.enter.prevent="fetchVNDBData"
            />
            <button 
              type="button"
              @click="fetchVNDBData"
              :disabled="fetchingVndb || !vndbId"
              class="shrink-0 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i v-if="fetchingVndb" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-cloud-arrow-down"></i>
              {{ fetchingVndb ? '获取中...' : '获取数据' }}
            </button>
          </div>
          <p class="text-xs text-gray-500">
            从 VNDB 网址获取 ID，如 https://vndb.org/<strong>v27448</strong>
          </p>
          <div v-if="vndbError" class="text-sm text-red-500">
            <i class="fa-solid fa-circle-exclamation mr-1"></i>{{ vndbError }}
            <NuxtLink v-if="duplicateGameId" :to="`/games/${duplicateGameId}`" class="ml-1 underline hover:text-red-400" target="_blank">查看游戏页面</NuxtLink>
          </div>
          <div v-if="vndbFetched" class="text-sm text-green-600 dark:text-green-400">
            <i class="fa-solid fa-circle-check mr-1"></i>已从 VNDB 获取数据，请检查并补充信息
          </div>
        </div>

        <!-- Bangumi ID 输入（预留） -->
        <div v-if="platform === 'bangumi'" class="space-y-3">
          <label class="block text-sm font-medium">Bangumi ID *</label>
          <div class="flex flex-col sm:flex-row gap-3">
            <input 
              v-model="bangumiId"
              type="text" 
              class="flex-1 px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-pink-400"
              placeholder="如：297264"
              disabled
            />
            <button 
              type="button"
              disabled
              class="shrink-0 px-4 py-2.5 rounded-lg bg-pink-600 text-white text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i class="fa-solid fa-clock"></i>
              即将支持
            </button>
          </div>
          <p class="text-xs text-gray-500">
            从 Bangumi 网址获取 ID，如 https://bgm.tv/subject/<strong>297264</strong>
          </p>
          <div class="p-3.5 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
            <i class="fa-solid fa-info-circle mr-2"></i>
            Bangumi 自动填充功能正在开发中，请暂时使用 VNDB。
          </div>
        </div>
      </div>

      <!-- 封面图片 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">封面图片 *</h2>
        
        <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <!-- 封面预览 -->
          <div class="w-full sm:w-40 sm:flex-shrink-0">
            <div 
              class="w-32 sm:w-full mx-auto aspect-[3/4] rounded-lg border-2 border-dashed dark:border-zinc-600 overflow-hidden bg-gray-50 dark:bg-zinc-700 flex items-center justify-center"
              :class="{ 'border-gray-300': !form.coverImage, 'border-transparent': form.coverImage }"
            >
              <img 
                v-if="form.coverImage" 
                :src="form.coverImage" 
                class="w-full h-full object-cover"
              />
              <div v-else class="text-center text-gray-400 p-4">
                <i class="fa-solid fa-image text-3xl mb-2"></i>
                <p class="text-xs">封面预览</p>
              </div>
            </div>
          </div>
          
          <!-- 上传区域 -->
          <div class="flex-1 space-y-4">
            <div 
              class="border-2 border-dashed rounded-lg p-3.5 sm:p-6 text-center cursor-pointer transition hover:border-gray-400 dark:hover:border-zinc-500"
              :class="uploading ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-zinc-600'"
              @click="triggerFileInput"
              @dragover.prevent.stop
              @drop.prevent.stop="handleDrop"
            >
              <input 
                ref="fileInputRef"
                type="file" 
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                class="hidden"
                @change.prevent.stop="handleFileSelect"
              />
              <div v-if="uploading" class="text-blue-600 dark:text-blue-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
                <p>上传中...</p>
              </div>
              <div v-else>
                <i class="fa-solid fa-cloud-arrow-up text-2xl text-gray-400 mb-2"></i>
                <p class="text-sm text-gray-600 dark:text-gray-400">点击或拖拽图片到此处上传</p>
                <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
              </div>
            </div>
            <div v-if="uploadError" class="text-sm text-red-500">
              <i class="fa-solid fa-circle-exclamation mr-1"></i>{{ uploadError }}
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
        
        <!-- 语言切换标签 -->
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
              <i v-if="form[lang.key as keyof typeof form]" class="fa-solid fa-check text-green-500 text-xs"></i>
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
        <h2 class="font-semibold text-base sm:text-lg border-b pb-3 dark:border-zinc-700">
          相关链接
          <span class="block sm:inline text-sm font-normal text-gray-500 sm:ml-2 mt-1 sm:mt-0">（可选）</span>
        </h2>
        
        <div class="space-y-3">
          <div
            v-for="(link, index) in purchaseLinks"
            :key="link._key"
            class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none dark:border-zinc-700"
          >
            <div class="flex items-center gap-2 sm:gap-3 sm:flex-1">
              <input 
                v-model="link.name"
                type="text" 
                class="w-28 sm:w-32 shrink-0 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                placeholder="平台名称"
              />
              <input 
                v-model="link.url"
                type="url" 
                class="flex-1 min-w-0 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                placeholder="https://..."
              />
              <button 
                type="button"
                @click="removePurchaseLink(index)"
                class="shrink-0 p-2 text-red-500 hover:text-red-600 transition"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          
          <button 
            type="button"
            @click="addPurchaseLink"
            class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5"
          >
            <i class="fa-solid fa-plus"></i>添加链接
          </button>
          
          <p class="text-xs text-gray-500">
            常见平台：Steam、DLsite、Getchu、DMM、官网等
          </p>
        </div>
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

      <!-- 制作人员 -->
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-3.5 sm:p-6 shadow space-y-4 sm:space-y-5">
        <div class="flex items-center justify-between border-b pb-3 dark:border-zinc-700">
          <h2 class="font-semibold text-base sm:text-lg">制作人员</h2>
          <button 
            type="button" 
            @click="addStaff" 
            class="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500"
          >
            <i class="fa-solid fa-plus mr-1"></i>添加
          </button>
        </div>
        
        <div v-if="staffList.length" class="space-y-3">
          <div v-for="(staff, index) in staffList" :key="staff._key" class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none dark:border-zinc-700">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0 w-full">
              <input 
                v-model="staff.name"
                type="text" 
                class="flex-1 min-w-0 sm:w-40 sm:flex-none px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                placeholder="姓名"
              />
              <input 
                v-model="staff.nameOriginal"
                type="text" 
                class="flex-1 min-w-0 sm:w-40 sm:flex-none px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
                placeholder="原名（可选）"
              />
            </div>
            <div class="flex items-center gap-2 sm:gap-3">
              <select 
                v-model="staff.role"
                class="flex-1 px-3 py-2 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 text-sm"
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
                class="shrink-0 p-2 text-red-500 hover:text-red-600 transition"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">暂无制作人员信息</p>
      </div>

      <!-- 管理员设置提示 -->
      <div class="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
        <i class="fa-solid fa-info-circle mr-2"></i>
        开发商、标签、游戏截图等信息将由管理员在后台添加。
      </div>

    </form>

    <!-- 底部固定操作栏 -->
    <div class="fixed bottom-0 left-0 right-0 z-30 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-gray-200 dark:border-zinc-700">
      <div class="max-w-3xl mx-auto grid grid-cols-2 sm:flex sm:justify-end gap-3">
        <NuxtLink 
          to="/"
          class="px-4 sm:px-6 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-center hover:bg-gray-100 dark:hover:bg-zinc-700"
        >
          取消
        </NuxtLink>
        <button 
          :disabled="loading || !canSubmit"
          class="px-4 sm:px-6 py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white text-sm hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50"
          @click="handleSubmit"
        >
          {{ loading ? '创建中...' : '创建条目' }}
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
import { nextTick } from 'vue'

definePageMeta({
  middleware: 'require-auth',
})

const router = useRouter()
const { $api } = useNuxtApp()
const { authFetch } = useAuthRequest()
const toast = useToast()

// 外部平台选择
const platform = ref<'vndb' | 'bangumi'>('vndb')
const vndbId = ref('')
const bangumiId = ref('')
const fetchingVndb = ref(false)
const vndbError = ref('')
const vndbFetched = ref(false)
const duplicateGameId = ref<number | null>(null)

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
  isNsfw: false,
})

const aliasesText = ref('')
const loading = ref(false)

// 行唯一 key（仅用于 v-for，提交前会剥离）
let rowKeySeed = 0

// 购买链接
const purchaseLinks = ref<{ _key: number; name: string; url: string }[]>([])

function addPurchaseLink() {
  purchaseLinks.value.push({ _key: ++rowKeySeed, name: '', url: '' })
}

function removePurchaseLink(index: number) {
  purchaseLinks.value.splice(index, 1)
}

// 制作人员
const staffList = ref<{ _key: number; name: string; nameOriginal: string; role: string }[]>([])

function addStaff() {
  staffList.value.push({ _key: ++rowKeySeed, name: '', nameOriginal: '', role: 'ARTIST' })
}

function removeStaff(index: number) {
  staffList.value.splice(index, 1)
}

// 是否可以提交
const canSubmit = computed(() => {
  // 必须有封面
  if (!form.coverImage) return false
  // 必须有至少一个标题
  if (!form.titleEn && !form.titleJa && !form.titleZhHans && !form.titleZhHant) return false
  // 必须有至少一个简介
  if (!form.descriptionEn && !form.descriptionJa && !form.descriptionZhHans && !form.descriptionZhHant) return false
  // 必须有外部 ID
  if (platform.value === 'vndb' && !vndbId.value) return false
  if (platform.value === 'bangumi' && !bangumiId.value) return false
  return true
})

// 触发文件选择
function triggerFileInput(e?: Event) {
  if (e) {
    e.stopPropagation()
  }
  fileInputRef.value?.click()
}

// 处理文件选择
async function handleFileSelect(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    openCoverCropper(input.files[0])
  }
  if (input) input.value = ''
}

// 处理拖放
async function handleDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
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

    const { token } = useAuth()
    const result = await $fetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
      headers: token.value ? { Authorization: token.value } : {},
    })

    await nextTick()
    form.coverImage = result.url
    toast.success('封面上传成功')
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
  
  // 支持直接输入 URL
  const urlMatch = rawId.match(/vndb\.org\/(v\d+)/)
  const id = urlMatch ? urlMatch[1] : rawId
  
  if (!id) {
    vndbError.value = 'VNDB ID 不能为空'
    return
  }
  
  if (!/^v\d+$/.test(id)) {
    vndbError.value = 'VNDB ID 格式错误，应为 v 开头加数字，如 v27448'
    return
  }
  
  vndbId.value = id
  vndbError.value = ''
  duplicateGameId.value = null
  fetchingVndb.value = true
  vndbFetched.value = false
  
  try {
    // 先检查站内是否已有相同 VNDB ID 的游戏
    try {
      const existing = await $fetch<{ id: number }>('/api/games/lookup', {
        query: { vndbId: id },
      })
      if (existing?.id) {
        duplicateGameId.value = existing.id
        vndbError.value = `站内已存在 VNDB ID 为 ${id} 的游戏条目，请勿重复创建`
        fetchingVndb.value = false
        return
      }
    } catch (lookupError: any) {
      // 404 表示站内不存在该游戏，可以继续获取 VNDB 数据
      if (lookupError?.status !== 404 && lookupError?.statusCode !== 404 && lookupError?.data?.statusCode !== 404) {
        // 其他错误忽略，继续尝试获取 VNDB 数据
      }
    }

    const data = await $fetch<{
      vndbId: string
      titleEn: string | null
      titleJa: string | null
      titleZhHans: string | null
      titleZhHant: string | null
      aliases: string[]
      descriptionEn: string | null
      released: string | null
      coverImage: string | null
      isNsfw: boolean
      staff: { name: string; nameOriginal: string | null; role: string; characterName: string | null }[]
    }>(`/api/vndb/${id}`)
    
    // 填充表单
    form.titleEn = data.titleEn || ''
    form.titleJa = data.titleJa || ''
    form.titleZhHans = data.titleZhHans || ''
    form.titleZhHant = data.titleZhHant || ''
    form.descriptionEn = data.descriptionEn || ''
    form.isNsfw = data.isNsfw
    
    // 处理发售日期
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
    
    // 填充别名
    aliasesText.value = data.aliases.join('\n')
    
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
        uploadError.value = 'VNDB 封面下载失败，请手动上传'
      } finally {
        uploading.value = false
      }
    }

    // 填充 Staff
    if (data.staff?.length) {
      staffList.value = data.staff.map(s => ({
        _key: ++rowKeySeed,
        name: s.name,
        nameOriginal: s.nameOriginal || '',
        role: s.role,
      }))
    }

    vndbFetched.value = true
  } catch (error: any) {
    vndbError.value = error.data?.message || '获取 VNDB 数据失败'
  } finally {
    fetchingVndb.value = false
  }
}

// 提交表单
async function handleSubmit(e?: Event) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }
  
  if (!canSubmit.value) {
    return
  }

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

    // 过滤有效的制作人员（剥离 _key，避免污染提交数据）
    const validStaff = staffList.value
      .filter(s => s.name)
      .map(s => ({ name: s.name, nameOriginal: s.nameOriginal, role: s.role }))

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
        isNsfw: form.isNsfw,
        vndbId: platform.value === 'vndb' ? vndbId.value : undefined,
        bangumiId: platform.value === 'bangumi' ? parseInt(bangumiId.value) : undefined,
        purchaseLinks: validPurchaseLinks.length > 0 ? validPurchaseLinks : undefined,
        staff: validStaff.length > 0 ? validStaff : undefined,
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
  title: computed(() => `创建游戏条目 - ${siteName.value}`),
})
</script>

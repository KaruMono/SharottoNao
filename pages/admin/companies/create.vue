<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/admin/companies" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <Icon name="fa6-solid:arrow-left" />
      </NuxtLink>
      <h1 class="text-2xl font-bold">创建会社</h1>
    </div>

    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Logo 上传 -->
        <div>
          <label class="block text-sm font-medium mb-2">会社 Logo</label>
          <div class="flex items-start gap-4">
            <div 
              class="w-24 h-24 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-zinc-600 cursor-pointer hover:border-gray-400 dark:hover:border-zinc-500 transition"
              @click="triggerLogoUpload"
            >
              <img v-if="form.logo" :src="form.logo" class="w-full h-full object-cover" />
              <div v-else class="text-center text-gray-400">
                <Icon name="fa6-solid:building" class="text-2xl mb-1" />
                <p class="text-xs">点击上传</p>
              </div>
            </div>
            <div class="flex-1 text-sm text-gray-500 dark:text-gray-400">
              <p>推荐尺寸：200x200 像素</p>
              <p>支持 JPG、PNG、WebP 格式</p>
              <p>将自动转换为 WebP 并裁剪为正方形</p>
              <button 
                v-if="form.logo"
                type="button"
                @click="form.logo = ''"
                class="mt-2 text-red-500 hover:text-red-600"
              >
                <Icon name="fa6-solid:trash" class="mr-1" />移除 Logo
              </button>
            </div>
          </div>
          <input 
            ref="logoInput"
            type="file" 
            accept="image/*"
            class="hidden"
            @change="handleLogoUpload"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium mb-2">会社名称 *</label>
            <input 
              v-model="form.name"
              type="text" 
              class="admin-input w-full"
              placeholder="如：Key"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">原名</label>
            <input 
              v-model="form.nameOriginal"
              type="text" 
              class="admin-input w-full"
              placeholder="如：株式会社ビジュアルアーツ"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">别名</label>
          <textarea 
            v-model="aliasesText"
            class="admin-textarea w-full"
            rows="3"
            placeholder="每行一个别名，用于模糊搜索&#10;如：&#10;Visual Arts&#10;VA&#10;ビジュアルアーツ"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">每行一个别名，方便在创建游戏条目时搜索到该会社</p>
        </div>

        <!-- 父会社设置 -->
        <div>
          <label class="block text-sm font-medium mb-2">所属母会社</label>
          <div v-if="form.parentId" class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-700 rounded-lg text-sm">
            <NuxtLink :to="`/companies/${form.parentId}`" target="_blank" class="font-medium flex-1 text-blue-500 hover:underline">{{ form.parentName }}</NuxtLink>
            <button type="button" @click="clearParent" class="text-gray-400 hover:text-red-500 transition">
              <Icon name="fa6-solid:xmark" />
            </button>
          </div>
          <div v-else class="relative">
            <input
              v-model="parentSearch"
              type="text"
              placeholder="搜索母会社名称..."
              class="admin-input w-full"
              @input="searchParent"
              @focus="showParentDropdown = true"
              @blur="hideParentDropdown"
            />
            <div
              v-if="showParentDropdown && parentResults.length"
              class="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-700 border dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-auto"
            >
              <button
                v-for="c in parentResults"
                :key="c.id"
                type="button"
                class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-600 transition"
                @mousedown.prevent="selectParent(c)"
              >{{ c.name }}</button>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">如该会社是某大公司旗下的品牌/子会社，可在此设置母会社</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium mb-2">成立年份</label>
            <input 
              v-model.number="form.foundedYear"
              type="number" 
              min="1900"
              max="2100"
              class="admin-input w-full"
              placeholder="如：1998"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">官网</label>
            <input 
              v-model="form.website"
              type="url" 
              class="admin-input w-full"
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">简介</label>
          <textarea 
            v-model="form.description"
            class="admin-textarea w-full"
            rows="4"
            placeholder="会社简介..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <AdminKumoButton variant="secondary"
            to="/admin/companies"
          >
            取消
          </AdminKumoButton>
          <AdminKumoButton variant="primary"
            type="submit"
            :disabled="loading"
          >
            {{ loading ? '创建中...' : '创建会社' }}
          </AdminKumoButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const router = useRouter()
const { authFetch } = useAuthRequest()
const toast = useToast()

const logoInput = ref<HTMLInputElement>()
const aliasesText = ref('')

// 父会社搜索
const parentSearch = ref('')
const parentResults = ref<{ id: number; name: string }[]>([])
const showParentDropdown = ref(false)
let parentTimer: ReturnType<typeof setTimeout>

const form = reactive({
  name: '',
  nameOriginal: '',
  logo: '',
  foundedYear: null as number | null,
  website: '',
  description: '',
  parentId: null as number | null,
  parentName: '',
})

const loading = ref(false)

function triggerLogoUpload() {
  logoInput.value?.click()
}

function searchParent() {
  clearTimeout(parentTimer)
  const q = parentSearch.value.trim()
  if (!q) { parentResults.value = []; return }
  parentTimer = setTimeout(async () => {
    try {
      const data: any = await $fetch('/api/companies', { query: { search: q, limit: 10 } } as any)
      parentResults.value = data.items || []
    } catch { parentResults.value = [] }
  }, 300)
}

function selectParent(c: { id: number; name: string }) {
  form.parentId = c.id
  form.parentName = c.name
  parentSearch.value = ''
  parentResults.value = []
  showParentDropdown.value = false
}

function clearParent() {
  form.parentId = null
  form.parentName = ''
}

function hideParentDropdown() {
  setTimeout(() => { showParentDropdown.value = false }, 150)
}

async function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件')
    return
  }

  // 验证文件大小 (最大 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('图片大小不能超过 5MB')
    return
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'logo')

    const result = await authFetch<{ url: string }>('/api/upload/image', {
      method: 'POST',
      body: formData,
    })
    
    form.logo = result.url
    toast.success('Logo上传成功')
  } catch (error: any) {
    toast.error(error.data?.message || '上传失败')
  } finally {
    input.value = ''
  }
}

async function handleSubmit() {
  if (!form.name) {
    toast.warning('请输入会社名称')
    return
  }
  
  // 解析别名
  const aliases = aliasesText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  loading.value = true
  try {
    const result = await authFetch<{ id: number }>('/api/admin/companies', {
      method: 'POST',
      body: {
        name: form.name,
        nameOriginal: form.nameOriginal || null,
        logo: form.logo || null,
        aliases,
        foundedYear: form.foundedYear || null,
        website: form.website || null,
        description: form.description || null,
        parentId: form.parentId,
      },
    })
    toast.success('会社创建成功')
    router.push('/admin/companies')
  } catch (error: any) {
    toast.error(error.data?.message || '创建失败')
  } finally {
    loading.value = false
  }
}

const siteName = useSiteName()
useHead({
  title: computed(() => `创建会社 - ${siteName.value} 管理后台`),
})
</script>

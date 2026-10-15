<template>
  <div class="flex items-center justify-center h-full py-8 px-2 md:px-4">
    <!-- 登录卡片容器 -->
    <div class="w-full max-w-4xl bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden">
      <div class="flex flex-col md:flex-row">
        <!-- 左侧 - 品牌展示区（手机端隐藏）-->
        <div class="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-8 md:p-10 flex-col justify-center relative overflow-hidden min-h-[520px]">
          <img
            v-if="hasBackgroundImage"
            :src="backgroundImageUrl"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
            @error="backgroundImageFailed = true"
          />
          <div v-if="hasBackgroundImage" class="absolute inset-0 bg-black/50"></div>
          <template v-else>
            <!-- 未配置图片或加载失败时使用默认背景 -->
            <div class="absolute top-16 left-8 w-24 h-24 bg-blue-200/30 dark:bg-blue-800/20 rounded-full"></div>
            <div class="absolute bottom-24 right-16 w-36 h-36 bg-blue-300/20 dark:bg-blue-700/10 rounded-full"></div>
            <div class="absolute bottom-16 left-1/4 w-20 h-20 bg-blue-100/40 dark:bg-blue-900/15 rounded-full"></div>
          </template>

          <!-- 品牌内容 -->
          <div class="relative z-10">
            <!-- 标题 -->
            <h2
              class="text-3xl md:text-4xl font-bold mb-3 break-words"
              :class="hasBackgroundImage ? 'text-white drop-shadow' : 'text-gray-800 dark:text-gray-100'"
            >
              {{ siteName }}
            </h2>

            <!-- 描述 -->
            <p
              class="text-base"
              :class="hasBackgroundImage ? 'text-white/90 drop-shadow' : 'text-gray-600 dark:text-gray-300'"
            >
              所以我们要留下很多幸福的回忆。
            </p>
          </div>
        </div>

        <!-- 右侧 - 登录表单区 -->
        <div class="md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
          <!-- 表单标题 -->
          <div class="mb-6">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              欢迎回来
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              登录 {{ siteName }} 账户
            </p>
          </div>

          <!-- 登录表单 -->
          <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                账号 <span class="text-red-500">*</span>
              </label>
              <CloudInput
                v-model="form.account"
                type="text"
                placeholder="请输入邮箱或用户名"
                autocomplete="username"
                required
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                密码 <span class="text-red-500">*</span>
              </label>
              <CloudInput
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                autocomplete="current-password"
                required
              />
            </div>

            <div v-if="errorMessage" class="text-red-500 text-sm">
              {{ errorMessage }}
            </div>

            <CloudButton
              type="submit"
              variant="primary"
              size="large"
              :loading="loading"
              full-width
            >
              {{ loading ? '登录中...' : '登录' }}
            </CloudButton>
          </form>

          <!-- 底部链接 -->
          <div class="mt-5 space-y-2 text-sm text-center">
            <div class="text-gray-600 dark:text-gray-400">
              还没有帐户？<NuxtLink to="/register" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">立即注册</NuxtLink>
            </div>
            <div class="text-gray-600 dark:text-gray-400">
              忘记了您的 <NuxtLink to="/forgot-password" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">密码</NuxtLink>？
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- 2FA 验证弹窗 -->
  <Teleport to="body">
    <div
      v-if="showTwoFactor"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="cancelTwoFactor"
    >
      <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2 class="text-lg font-bold mb-2">两步验证</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
          请打开您的 Authenticator 应用，输入 6 位验证码
        </p>

        <div class="flex gap-2 justify-center mb-5">
          <input
            v-for="(_, i) in totpDigits"
            :key="i"
            :ref="el => (digitRefs[i] = el as HTMLInputElement)"
            v-model="totpDigits[i]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            class="w-10 h-12 text-center text-lg font-bold border rounded-lg dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
            @input="onDigitInput(i)"
            @keydown.backspace="onBackspace(i)"
            @paste.prevent="onPaste"
          />
        </div>

        <div v-if="twoFactorError" class="text-red-500 text-sm text-center mb-3">
          {{ twoFactorError }}
        </div>

        <CloudButton
          variant="primary"
          size="large"
          :disabled="totpCode.length < 6"
          :loading="twoFactorLoading"
          full-width
          @click="handleTwoFactor"
        >
          {{ twoFactorLoading ? '验证中...' : '验证' }}
        </CloudButton>

        <CloudButton
          variant="ghost"
          full-width
          class="mt-2"
          @click="cancelTwoFactor"
        >
          取消，重新登录
        </CloudButton>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<script setup lang="ts">
const { signIn } = useAuth()
const route = useRoute()
const router = useRouter()

// 随机结果随 Nuxt 数据一起传给客户端，避免服务端渲染和水合时选到不同图片。
const { data: loginBackground } = await useFetch<{ imageUrl: string }, Error, string & {}>('/api/login-background', {
  key: 'login-background',
})
const backgroundImageUrl = computed(() => loginBackground.value?.imageUrl || '')
const backgroundImageFailed = ref(false)
const hasBackgroundImage = computed(() => !!backgroundImageUrl.value && !backgroundImageFailed.value)
watch(backgroundImageUrl, () => { backgroundImageFailed.value = false })

const form = reactive({
  account: '',
  password: '',
})

const loading = ref(false)
const errorMessage = ref('')

// 2FA 状态
const showTwoFactor = ref(false)
const tempToken = ref('')
const totpDigits = ref(['', '', '', '', '', ''])
const digitRefs = ref<HTMLInputElement[]>([])
const twoFactorError = ref('')
const twoFactorLoading = ref(false)

const totpCode = computed(() => totpDigits.value.join(''))

async function handleLogin() {
  loading.value = true
  errorMessage.value = ''

  try {
    // 直接调接口，判断是否需要 2FA
    const res: any = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { account: form.account, password: form.password },
    } as any)

    if (res.needsTwoFactor) {
      tempToken.value = res.tempToken
      showTwoFactor.value = true
      // 等弹窗渲染后聚焦第一格
      await nextTick()
      digitRefs.value[0]?.focus()
    } else {
      // 无 2FA，通过 signIn 写入 session
      await signIn({ account: form.account, password: form.password }, { redirect: false })
      const redirect = route.query.redirect as string || '/'
      router.push(redirect)
    }
  } catch (error: any) {
    errorMessage.value = error.data?.message || '邮箱或密码错误'
  } finally {
    loading.value = false
  }
}

function onDigitInput(index: number) {
  const val = totpDigits.value[index]
  // 过滤非数字
  totpDigits.value[index] = val.replace(/\D/g, '').slice(-1)
  if (totpDigits.value[index] && index < 5) {
    digitRefs.value[index + 1]?.focus()
  }
  if (totpCode.value.length === 6) {
    handleTwoFactor()
  }
}

function onBackspace(index: number) {
  if (!totpDigits.value[index] && index > 0) {
    totpDigits.value[index - 1] = ''
    digitRefs.value[index - 1]?.focus()
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || ''
  for (let i = 0; i < 6; i++) {
    totpDigits.value[i] = text[i] || ''
  }
  if (text.length === 6) handleTwoFactor()
}

async function handleTwoFactor() {
  if (totpCode.value.length < 6 || twoFactorLoading.value) return
  twoFactorLoading.value = true
  twoFactorError.value = ''

  try {
    const res: any = await ($fetch as any)('/api/auth/2fa/verify', {
      method: 'POST',
      body: { tempToken: tempToken.value, code: totpCode.value },
    } as any)

    // 用 signIn 写入 session（携带已验证的邮密）
    await signIn({ account: form.account, password: form.password }, { redirect: false })
    showTwoFactor.value = false
    const redirect = route.query.redirect as string || '/'
    router.push(redirect)
  } catch (error: any) {
    twoFactorError.value = error.data?.message || '验证码错误，请重试'
    totpDigits.value = ['', '', '', '', '', '']
    await nextTick()
    digitRefs.value[0]?.focus()
  } finally {
    twoFactorLoading.value = false
  }
}

function cancelTwoFactor() {
  showTwoFactor.value = false
  tempToken.value = ''
  totpDigits.value = ['', '', '', '', '', '']
  twoFactorError.value = ''
}

const siteName = useSiteName()
useHead({
  title: computed(() => `登录 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

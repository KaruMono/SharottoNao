<template>
  <div>
  <div class="max-w-md mx-auto px-2.5 sm:px-4 md:px-6 py-8 md:py-12">
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-6 md:p-8 shadow">
      <h1 class="text-xl md:text-2xl font-bold text-center mb-6 md:mb-8">登录</h1>

      <form @submit.prevent="handleLogin" class="space-y-4 md:space-y-5">
        <div>
          <label class="block text-sm font-medium mb-2">邮箱</label>
          <input
            v-model="form.email"
            type="email"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="your@email.com"
            autocomplete="username"
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">密码</label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="••••••••"
            required
          />
        </div>

        <div v-if="errorMessage" class="text-red-500 text-sm text-center">
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="mt-6 space-y-2 text-center text-sm text-gray-500">
        <div>
          <NuxtLink to="/forgot-password" class="text-gray-600 dark:text-gray-400 hover:underline">
            忘记密码？
          </NuxtLink>
        </div>
        <div>
          还没有账号？
          <NuxtLink to="/register" class="text-gray-800 dark:text-gray-200 hover:underline">
            立即注册
          </NuxtLink>
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

        <button
          :disabled="totpCode.length < 6 || twoFactorLoading"
          class="w-full py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 disabled:opacity-50 transition"
          @click="handleTwoFactor"
        >
          {{ twoFactorLoading ? '验证中...' : '验证' }}
        </button>

        <button
          class="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
          @click="cancelTwoFactor"
        >
          取消，重新登录
        </button>
      </div>
    </div>
  </Teleport>
  </div>
</template>

<script setup lang="ts">
const { signIn } = useAuth()
const route = useRoute()
const router = useRouter()

const form = reactive({
  email: '',
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
    const res = await $fetch<any>('/api/auth/login', {
      method: 'POST',
      body: { email: form.email, password: form.password },
    })

    if (res.needsTwoFactor) {
      tempToken.value = res.tempToken
      showTwoFactor.value = true
      // 等弹窗渲染后聚焦第一格
      await nextTick()
      digitRefs.value[0]?.focus()
    } else {
      // 无 2FA，通过 signIn 写入 session
      await signIn({ email: form.email, password: form.password }, { redirect: false })
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
    const res = await $fetch<any>('/api/auth/2fa/verify', {
      method: 'POST',
      body: { tempToken: tempToken.value, code: totpCode.value },
    })

    // 用 signIn 写入 session（携带已验证的邮密）
    await signIn({ email: form.email, password: form.password }, { redirect: false })
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

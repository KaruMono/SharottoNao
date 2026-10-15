<template>
  <div class="max-w-md mx-auto px-2.5 sm:px-4 md:px-6 py-10 md:py-12">
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow">
      <h1 class="text-2xl font-bold text-center mb-8">注册账号</h1>

      <form @submit.prevent="handleRegister" class="space-y-5">
        <CloudInput
          v-model="form.username"
          type="text"
          label="用户名"
          placeholder="2-20个字符"
          required
        />

        <CloudInput
          v-model="form.email"
          type="email"
          label="邮箱"
          placeholder="请输入邮箱"
          required
        />

        <CloudInput
          v-model="form.password"
          type="password"
          label="密码"
          placeholder="至少8个字符，包含字母和数字"
          autocomplete="new-password"
          required
        />

        <div>
          <CloudInput
            v-model="form.confirmPassword"
            type="password"
            label="确认密码"
            placeholder="再次输入密码"
            autocomplete="new-password"
            :error="passwordMismatch ? '两次输入的密码不一致' : ''"
            required
            @blur="checkPasswordMatch"
          />
        </div>

        <!-- 图片验证码 -->
        <div>
          <label class="block text-sm font-medium mb-2">图片验证码</label>
          <div class="flex gap-2 items-center">
            <CloudInput
              v-model="form.captcha"
              type="text"
              maxlength="5"
              autocomplete="off"
              placeholder="输入图中字符"
              required
              class="flex-1 min-w-0"
            />
            <button
              type="button"
              @click="refreshCaptcha"
              class="flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-gray-200 dark:ring-zinc-700 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 relative"
              title="点击刷新"
            >
              <img
                v-if="captchaSrc"
                :src="captchaSrc"
                alt="图片验证码"
                class="h-[44px] w-[140px] block"
                draggable="false"
              />
              <div
                v-else
                class="h-[44px] w-[140px] flex items-center justify-center bg-gray-100 dark:bg-zinc-700 text-xs text-gray-400"
              >
                <Icon name="fa6-solid:spinner" class="fa-spin" />
              </div>
            </button>
          </div>
        </div>

        <!-- 邮件验证码 -->
        <div>
          <label class="block text-sm font-medium mb-2">邮箱验证码</label>
          <div class="flex gap-2">
            <CloudInput
              v-model="form.code"
              type="text"
              maxlength="6"
              placeholder="6位验证码"
              required
              class="flex-1 min-w-0"
            />
            <CloudButton
              type="button"
              variant="secondary"
              size="large"
              class="w-28"
              @click="sendCode"
              :disabled="codeCountdown > 0"
              :loading="codeSending"
            >
              {{ codeCountdown > 0 ? `${codeCountdown}s` : (codeSending ? '发送中...' : '发送验证码') }}
            </CloudButton>
          </div>
        </div>

        <div v-if="errorMessage" class="text-red-500 text-sm text-center">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="text-green-500 text-sm text-center">
          {{ successMessage }}
        </div>

        <CloudButton
          type="submit"
          variant="primary"
          size="large"
          :loading="loading"
          full-width
        >
          {{ loading ? '注册中...' : '注册' }}
        </CloudButton>
      </form>

      <div class="mt-6 border-t border-gray-100 pt-5 text-center dark:border-zinc-700">
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">已有账号？</p>
        <CloudButton to="/login" full-width>
          立即登录
        </CloudButton>
      </div>
    </div>
    

  </div>
</template>

<script setup lang="ts">
const { signIn } = useAuth()
const router = useRouter()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  captcha: '',
})

const loading = ref(false)
const codeSending = ref(false)
const codeCountdown = ref(0)
const errorMessage = ref('')
const successMessage = ref('')
const passwordMismatch = ref(false)
const captchaSrc = ref('')

let countdownTimer: ReturnType<typeof setInterval>

function refreshCaptcha() {
  captchaSrc.value = `/api/captcha?t=${Date.now()}`
  form.captcha = ''
}

onMounted(() => {
  refreshCaptcha()
})

function checkPasswordMatch() {
  if (form.confirmPassword && form.password !== form.confirmPassword) {
    passwordMismatch.value = true
  } else {
    passwordMismatch.value = false
  }
}

// 监听密码变化，实时检查
watch(() => form.password, () => {
  if (form.confirmPassword) {
    checkPasswordMatch()
  }
})

watch(() => form.confirmPassword, () => {
  checkPasswordMatch()
})

async function sendCode() {
  if (!form.email) {
    errorMessage.value = '请先输入邮箱'
    return
  }

  // 显示滑动验证
  errorMessage.value = ''
  successMessage.value = ''
  codeSending.value = true

  try {
    await ($fetch as any)('/api/auth/send-code', {
      method: 'POST',
      body: {
        email: form.email,
        type: 'REGISTER',
      },
    })
    successMessage.value = '验证码已发送，请查收邮件'
    codeCountdown.value = 60
    
    countdownTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) {
        clearInterval(countdownTimer)
      }
    }, 1000)
  } catch (error: any) {
    errorMessage.value = error.data?.message || '发送失败，请稍后再试'
  } finally {
    codeSending.value = false
  }
}

async function handleRegister() {
  if (!form.username || !form.email || !form.password || !form.confirmPassword || !form.code || !form.captcha) {
    errorMessage.value = '请填写完整信息'
    return
  }

  if (form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    passwordMismatch.value = true
    return
  }

  if (form.password.length < 8) {
    errorMessage.value = '密码至少需要8个字符'
    return
  }

  if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(form.password)) {
    errorMessage.value = '密码必须包含字母和数字'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await ($fetch as any)('/api/auth/register', {
      method: 'POST',
      body: {
        username: form.username,
        email: form.email,
        password: form.password,
        code: form.code,
        captcha: form.captcha,
      },
    })
    // 注册成功后自动登录
    successMessage.value = '注册成功！正在登录...'
    try {
      await signIn({
        email: form.email,
        password: form.password,
      }, { redirect: false })
      router.push('/')
    } catch {
      // 自动登录失败则跳转到登录页
      setTimeout(() => {
        router.push('/login')
      }, 1000)
    }
  } catch (error: any) {
    errorMessage.value = error.data?.message || '注册失败，请稍后再试'
    refreshCaptcha()
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})

const siteName = useSiteName()
useHead({
  title: computed(() => `注册 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

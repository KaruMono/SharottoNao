<template>
  <div class="max-w-md mx-auto px-2.5 sm:px-4 md:px-6 py-10 md:py-12">
    <div class="bg-white dark:bg-zinc-800 rounded-xl p-8 shadow">
      <h1 class="text-2xl font-bold text-center mb-2">忘记密码</h1>
      <p class="text-center text-gray-500 text-sm mb-8">输入您的邮箱，我们将发送验证码帮助您重置密码</p>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- 邮箱 -->
        <div>
          <label class="block text-sm font-medium mb-2">邮箱</label>
          <input 
            v-model="form.email"
            type="email" 
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="your@email.com"
            required
            :disabled="step === 2"
          />
        </div>

        <!-- 验证码（第二步） -->
        <div v-if="step === 2">
          <label class="block text-sm font-medium mb-2">验证码</label>
          <div class="flex gap-2">
            <input 
              v-model="form.code"
              type="text" 
              class="flex-1 min-w-0 px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="输入验证码"
              required
            />
            <button 
              type="button"
              @click="sendCode"
              :disabled="codeCooldown > 0 || sendingCode"
              class="flex-shrink-0 w-28 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition"
            >
              {{ sendingCode ? '发送中...' : (codeCooldown > 0 ? `${codeCooldown}s` : '重新发送') }}
            </button>
          </div>
        </div>

        <!-- 新密码（第二步） -->
        <div v-if="step === 2">
          <label class="block text-sm font-medium mb-2">新密码</label>
          <input 
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="至少8位，包含字母和数字"
            minlength="8"
            required
          />
        </div>

        <!-- 确认密码（第二步） -->
        <div v-if="step === 2">
          <label class="block text-sm font-medium mb-2">确认密码</label>
          <input 
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full px-4 py-2.5 rounded-lg border dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
            :class="{ 'border-red-500': form.password && form.confirmPassword && form.password !== form.confirmPassword }"
            placeholder="再次输入密码"
            required
          />
          <p v-if="form.password && form.confirmPassword && form.password !== form.confirmPassword" class="text-xs text-red-500 mt-1">
            两次输入的密码不一致
          </p>
        </div>

        <div v-if="errorMessage" class="text-red-500 text-sm text-center">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="text-green-500 text-sm text-center">
          {{ successMessage }}
        </div>

        <button 
          type="submit"
          :disabled="loading || (step === 2 && form.password !== form.confirmPassword)"
          class="w-full py-2.5 rounded-lg bg-gray-800 dark:bg-zinc-600 text-white font-medium hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition"
        >
          {{ loading ? '处理中...' : (step === 1 ? '发送验证码' : '重置密码') }}
        </button>
      </form>

      <div class="mt-6 text-center text-sm text-gray-500">
        <NuxtLink to="/login" class="text-gray-800 dark:text-gray-200 hover:underline">
          <i class="fa-solid fa-arrow-left mr-1"></i>返回登录
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const toast = useToast()

const step = ref(1) // 1: 输入邮箱, 2: 输入验证码和新密码
const form = reactive({
  email: '',
  code: '',
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const sendingCode = ref(false)
const codeCooldown = ref(0)
const errorMessage = ref('')
const successMessage = ref('')

let cooldownTimer: ReturnType<typeof setInterval> | null = null

async function sendCode() {
  if (sendingCode.value || codeCooldown.value > 0) return
  
  sendingCode.value = true
  errorMessage.value = ''
  
  try {
    await $fetch('/api/auth/send-code', {
      method: 'POST',
      body: {
        email: form.email,
        type: 'RESET_PASSWORD',
      },
    })
    
    toast.success('验证码已发送到您的邮箱')
    
    // 开始倒计时
    codeCooldown.value = 60
    cooldownTimer = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  } catch (error: any) {
    errorMessage.value = error.data?.message || '发送失败，请稍后再试'
  } finally {
    sendingCode.value = false
  }
}

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  
  if (step.value === 1) {
    // 第一步：发送验证码
    loading.value = true
    try {
      await $fetch('/api/auth/send-code', {
        method: 'POST',
        body: {
          email: form.email,
          type: 'RESET_PASSWORD',
        },
      })
      
      toast.success('验证码已发送到您的邮箱')
      step.value = 2
      
      // 开始倒计时
      codeCooldown.value = 60
      cooldownTimer = setInterval(() => {
        codeCooldown.value--
        if (codeCooldown.value <= 0 && cooldownTimer) {
          clearInterval(cooldownTimer)
          cooldownTimer = null
        }
      }, 1000)
    } catch (error: any) {
      errorMessage.value = error.data?.message || '发送失败，请稍后再试'
    } finally {
      loading.value = false
    }
  } else {
    // 第二步：重置密码
    if (form.password !== form.confirmPassword) {
      errorMessage.value = '两次输入的密码不一致'
      return
    }
    
    loading.value = true
    try {
      await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: {
          email: form.email,
          code: form.code,
          password: form.password,
        },
      })
      
      toast.success('密码重置成功，请登录')
      router.push('/login')
    } catch (error: any) {
      errorMessage.value = error.data?.message || '重置失败，请稍后再试'
    } finally {
      loading.value = false
    }
  }
}

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
})

const siteName = useSiteName()
useHead({
  title: computed(() => `忘记密码 - ${siteName.value}`),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

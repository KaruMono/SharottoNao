const { existsSync, readFileSync } = require('fs')
const { resolve } = require('path')

// 读取 .env 文件并解析为环境变量对象
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8')
    const env = {}
    for (const line of content.split(/\r?\n/)) {
      let trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      // 兼容 "export KEY=value" 写法
      if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trim()
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
    return env
  } catch {
    return {}
  }
}

const appRoot = process.env.CHARLOTTE_APP_ROOT || __dirname
const requestedCurrentDir = resolve(process.env.CHARLOTTE_CURRENT_DIR || resolve(appRoot, 'current'))
const currentWasExplicitlyConfigured = Boolean(process.env.CHARLOTTE_CURRENT_DIR)

// 本地开发仍使用根目录 .output；生产部署则通过 current 软链接指向一个
// 不可变 release。检查入口文件，避免第一次部署前 PM2 指向不存在的链接。
const currentDir = existsSync(resolve(requestedCurrentDir, '.output/server/index.mjs'))
  ? requestedCurrentDir
  : currentWasExplicitlyConfigured || process.env.CHARLOTTE_REQUIRE_CURRENT === 'true'
    ? (() => { throw new Error(`Charlotte current release is unavailable: ${requestedCurrentDir}`) })()
    : appRoot

const envFile = process.env.CHARLOTTE_ENV_FILE || resolve(appRoot, 'shared/.env')
const dotenv = loadEnv(existsSync(envFile) ? envFile : resolve(appRoot, '.env'))

// shell/PM2 注入的变量优先于文件变量，便于发布脚本在切换时传递版本号和端口。
// Windows 的进程环境里可能有带点号/括号的变量名，不能作为 Node 环境变量传递。
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)),
)
const runtimeEnv = {
  ...dotenv,
  ...inheritedEnv,
}

function readReleaseId(dir) {
  try {
    return readFileSync(resolve(dir, '.release-id'), 'utf8').trim()
  } catch {
    return ''
  }
}

const releaseFileId = readReleaseId(currentDir)
const releaseId = releaseFileId || runtimeEnv.CHARLOTTE_RELEASE_ID
// current release 的元数据是权威来源，避免 PM2 保存的旧环境变量造成版本漂移。
if (releaseId) {
  runtimeEnv.NUXT_PUBLIC_BUILD_ID = releaseId
}
if (releaseFileId) {
  runtimeEnv.CHARLOTTE_RELEASE_ID = releaseFileId
}

// 本地存储必须位于 release 之外，否则切换版本会让上传文件"消失"。
// 显式绝对路径仍可覆盖该默认值（例如挂载到独立磁盘）。
const useSharedUploads = runtimeEnv.NODE_ENV === 'production' || existsSync(resolve(appRoot, 'current'))
const sharedUploadDir = resolve(appRoot, 'shared/uploads')
if (useSharedUploads && runtimeEnv.S3_ENABLED !== 'true' && (!runtimeEnv.LOCAL_UPLOAD_PATH || runtimeEnv.LOCAL_UPLOAD_PATH === './uploads' || resolve(runtimeEnv.LOCAL_UPLOAD_PATH) === sharedUploadDir)) {
  // The storage resolver accepts absolute paths, so the upload directory stays
  // outside the release even when process.cwd() changes after a switch.
  runtimeEnv.LOCAL_UPLOAD_PATH = sharedUploadDir
}
if (useSharedUploads && !runtimeEnv.CHARLOTTE_STATIC_ASSET_ROOT) {
  runtimeEnv.CHARLOTTE_STATIC_ASSET_ROOT = resolve(appRoot, 'shared/nuxt-assets')
}
if (useSharedUploads && !runtimeEnv.CHARLOTTE_LOCK_DIR) {
  runtimeEnv.CHARLOTTE_LOCK_DIR = resolve(appRoot, 'shared/.charlotte-locks')
}

function numericEnv(name, fallback) {
  const value = Number(runtimeEnv[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

module.exports = {
  apps: [
    {
      name: runtimeEnv.CHARLOTTE_APP_NAME || 'charlotte',
      script: resolve(currentDir, '.output/server/index.mjs'),
      cwd: currentDir,
      // cluster 模式利用多核提升 SSR 吞吐；定时任务先用 instance 0 降重，
      // 再通过共享 Redis/文件锁跨 release 防重复（server/utils/instance.ts）。
      // 内存充足的话可以调大 instances（如 'max' 用满所有核心）
      instances: runtimeEnv.CHARLOTTE_INSTANCES === 'max'
        ? 'max'
        : numericEnv('CHARLOTTE_INSTANCES', 2),
      exec_mode: runtimeEnv.CHARLOTTE_EXEC_MODE || 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // 每天凌晨 4 点自动优雅重载（避开用户高峰期）
      cron_restart: '0 4 * * *',
      // Nitro 收到 SIGINT/SIGTERM 后需要时间结束请求并释放 Prisma/Redis。
      // 默认 PM2 kill_timeout 只有 1.6s，容易截断静态资源响应。
      kill_timeout: numericEnv('CHARLOTTE_KILL_TIMEOUT', 35000),
      listen_timeout: numericEnv('CHARLOTTE_LISTEN_TIMEOUT', 30000),
      restart_delay: numericEnv('CHARLOTTE_RESTART_DELAY', 1000),
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: 5000,
      wait_ready: false,
      instance_var: 'NODE_APP_INSTANCE',
      merge_logs: true,
      time: true,
      env: {
        ...runtimeEnv,
        NODE_ENV: 'production',
        PORT: runtimeEnv.PORT || 3000,
      },
    },
  ],
}

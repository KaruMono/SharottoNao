const { readFileSync } = require('fs')
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

const dotenv = loadEnv(resolve(__dirname, '.env'))

module.exports = {
  apps: [
    {
      name: 'charlotte',
      script: '.output/server/index.mjs',
      cwd: __dirname,
      // cluster 模式利用多核提升 SSR 吞吐；定时任务已通过
      // NODE_APP_INSTANCE 保证只在实例 0 执行（server/utils/instance.ts）
      // 内存充足的话可以调大 instances（如 'max' 用满所有核心）
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ...dotenv,
      },
    },
  ],
}

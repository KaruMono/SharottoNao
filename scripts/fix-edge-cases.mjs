#!/usr/bin/env node
/**
 * 处理最后的边界情况：
 * 1. 对象字面量中的条件 class
 * 2. 分离的 fa-solid 和 fa-icon
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const ROOT = join(__dirname, '..')

const FILES_TO_FIX = [
  'pages/admin/indexnow.vue',
  'pages/admin/scheduled-tasks.vue',
  'pages/admin/vndb-tags.vue',
  'pages/following.vue',
  'pages/games/index.vue',
  'pages/games/[id]/index.vue',
]

async function fixFile(filePath) {
  const fullPath = join(ROOT, filePath)
  let content = await readFile(fullPath, 'utf8')
  let changes = 0

  // 修复 1: 'fa-solid fa-icon text-color': condition -> 先转换为 fa6-solid:icon
  content = content.replace(/'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)([^']*)':\s*([^,\n]+)/g, (match, faStyle, style, iconName, extraClasses, condition) => {
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    changes++
    return `'${iconifyStyle}:${icon}${extraClasses}': ${condition}`
  })

  // 修复 2: class="fa-solid" :class="condition ? 'fa-icon1' : 'fa-icon2'"
  // 这种需要转换为 <Icon :name="condition ? 'fa6-solid:icon1' : 'fa6-solid:icon2'" />

  // 修复 3: 函数返回的 FA class
  content = content.replace(/return\s+'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)([^']*)'/g, (match, faStyle, style, iconName, extraClasses) => {
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    changes++
    return `return '${iconifyStyle}:${icon}${extraClasses}'`
  })

  // 修复 4: 对象中多行的 icon 定义
  content = content.replace(/(WISHLIST|PLAYING|COMPLETED|ON_HOLD):\s*'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)([^']*)',/g, (match, key, faStyle, style, iconName, extraClasses) => {
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    changes++
    return `${key}: '${iconifyStyle}:${icon}${extraClasses}',`
  })

  if (changes > 0) {
    await writeFile(fullPath, content, 'utf8')
    console.log(`✅ ${filePath}: ${changes} 处修复`)
  }

  return changes
}

async function main() {
  console.log('🔧 修复特殊情况...\n')

  let total = 0
  for (const file of FILES_TO_FIX) {
    try {
      const changes = await fixFile(file)
      total += changes
    } catch (e) {
      console.warn(`⚠️  ${file}: ${e.message}`)
    }
  }

  console.log(`\n✨ 总计修复: ${total} 处`)
}

main().catch(console.error)

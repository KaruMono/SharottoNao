#!/usr/bin/env node
/**
 * 修复最后剩余的图标引用（JS 对象中的字符串）
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const ROOT = join(__dirname, '..')

const filesToFix = [
  'pages/admin/scheduled-tasks.vue',
  'pages/games/[id]/index.vue',
]

async function fixFile(path) {
  const fullPath = join(ROOT, path)
  let content = await readFile(fullPath, 'utf8')
  let changes = 0

  // 替换所有 'fa-solid fa-icon ...' 为 'fa6-solid:icon ...'
  content = content.replace(/'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)([^']*)'/g, (match, faStyle, style, iconName, rest) => {
    changes++
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    return `'${iconifyStyle}:${icon}${rest}'`
  })

  if (changes > 0) {
    await writeFile(fullPath, content, 'utf8')
    console.log(`✅ ${path}: ${changes} 处修复`)
  }

  return changes
}

async function main() {
  console.log('🔧 修复剩余的图标字符串...\n')

  let total = 0
  for (const file of filesToFix) {
    try {
      total += await fixFile(file)
    } catch (e) {
      console.warn(`⚠️  ${file}: ${e.message}`)
    }
  }

  console.log(`\n✨ 总计: ${total} 处`)
}

main().catch(console.error)

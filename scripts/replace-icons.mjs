#!/usr/bin/env node
/**
 * 批量替换 FontAwesome class 为 Icon 组件
 *
 * 用法: node scripts/replace-icons.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = join(fileURLToPath(import.meta.url), '..')
const ROOT = join(__dirname, '..')

const SCAN_DIRS = [
  join(ROOT, 'pages'),
  join(ROOT, 'components'),
  join(ROOT, 'layouts'),
  join(ROOT, 'app.vue'),
]

const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', 'dist', '.git'])
const SCAN_EXTENSIONS = new Set(['.vue'])

let filesProcessed = 0
let replacementsCount = 0

async function* walk(path) {
  try {
    const stat = await readdir(path, { withFileTypes: true }).catch(() => null)
    if (!stat) {
      // 可能是文件而不是目录
      if (path.endsWith('.vue')) {
        yield path
      }
      return
    }

    for (const entry of stat) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(path, entry.name)

      if (entry.isDirectory()) {
        yield* walk(full)
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf('.')
        if (dot >= 0 && SCAN_EXTENSIONS.has(entry.name.slice(dot))) {
          yield full
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }
}

function replaceIconsInContent(content) {
  let newContent = content
  let count = 0

  // 模式 1: <i class="fa-solid fa-heart"></i> -> <Icon name="fa6-solid:heart" />
  // 模式 2: <i class="fa-solid fa-heart text-red-500"></i> -> <Icon name="fa6-solid:heart" class="text-red-500" />

  // 处理简单的图标标签（无额外属性或只有 class）
  const simpleIconPattern = /<i\s+class="(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)(\s+[^"]*)?"\s*><\/i>/g
  newContent = newContent.replace(simpleIconPattern, (match, faStyle, style, iconName, extraClasses) => {
    count++
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    const classes = extraClasses ? extraClasses.trim() : ''

    if (classes) {
      return `<Icon name="${iconifyStyle}:${icon}" class="${classes}" />`
    } else {
      return `<Icon name="${iconifyStyle}:${icon}" />`
    }
  })

  // 处理带有 :class 绑定的图标（动态 class）
  const dynamicClassPattern = /<i\s+:class="([^"]+)"\s*><\/i>/g
  // 这种情况比较复杂，暂时保留，后续手动处理

  // 处理带有其他属性的图标
  const complexIconPattern = /<i\s+([^>]*class="(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)[^"]*"[^>]*)><\/i>/g
  newContent = newContent.replace(complexIconPattern, (match, allAttrs, faStyle, style, iconName) => {
    // 复杂情况：提取 class 和其他属性
    const classMatch = allAttrs.match(/class="([^"]+)"/)
    const otherAttrsMatch = allAttrs.replace(/class="[^"]*"/, '').trim()

    if (!classMatch) return match

    const classes = classMatch[1]
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')

    // 移除 fa-solid/regular/brands 和 fa-iconname，保留其他 class
    const cleanClasses = classes
      .split(/\s+/)
      .filter(c => !c.startsWith('fa-') || (!c.match(/^fa-(solid|regular|brands)$/) && !c.match(/^fa-[a-z0-9-]+$/)))
      .join(' ')

    count++

    let result = `<Icon name="${iconifyStyle}:${icon}"`
    if (cleanClasses) {
      result += ` class="${cleanClasses}"`
    }
    if (otherAttrsMatch) {
      result += ` ${otherAttrsMatch}`
    }
    result += ` />`

    return result
  })

  return { newContent, count }
}

async function main() {
  console.log('🔄 开始批量替换图标...\n')

  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      try {
        const content = await readFile(file, 'utf8')
        const { newContent, count } = replaceIconsInContent(content)

        if (count > 0) {
          await writeFile(file, newContent, 'utf8')
          filesProcessed++
          replacementsCount += count
          const rel = relative(ROOT, file)
          console.log(`✅ ${rel}: ${count} 处替换`)
        }
      } catch (e) {
        console.warn(`⚠️  处理文件失败: ${file}`, e.message)
      }
    }
  }

  console.log(`\n✨ 完成！`)
  console.log(`📄 处理文件: ${filesProcessed}`)
  console.log(`🔄 替换次数: ${replacementsCount}`)
  console.log('\n⚠️  注意：带有动态 :class 绑定的图标需要手动检查和替换')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

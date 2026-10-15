#!/usr/bin/env node
/**
 * 处理剩余的复杂图标情况
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
]

const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', 'dist', '.git'])
const SCAN_EXTENSIONS = new Set(['.vue'])

let filesProcessed = 0
let replacementsCount = 0

async function* walk(path) {
  try {
    const stat = await readdir(path, { withFileTypes: true }).catch(() => null)
    if (!stat) return

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
  } catch (e) {}
}

function replaceComplexIcons(content) {
  let newContent = content
  let count = 0

  // 模式 1: JS 对象中的 icon: 'fa-solid fa-icon'
  newContent = newContent.replace(/icon:\s*'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)'/g, (match, faStyle, style, iconName) => {
    count++
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    return `icon: '${iconifyStyle}:${icon}'`
  })

  // 模式 2: class: 'fa-solid fa-icon' (在对象中)
  newContent = newContent.replace(/class:\s*'(fa-(solid|regular|brands))\s+(fa-[a-z0-9-]+)'/g, (match, faStyle, style, iconName) => {
    count++
    const iconifyStyle = `fa6-${style}`
    const icon = iconName.replace('fa-', '')
    return `class: '${iconifyStyle}:${icon}'`
  })

  // 模式 3: 复杂的三元表达式 <i :class="loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-icon'">
  newContent = newContent.replace(/<i\s+:class="([^"]+\?[^"]+:[^"]+)"\s*(?:aria-hidden="true")?\s*><\/i>/g, (match, ternary) => {
    let modified = false

    // 转换三元表达式中的每个 FA class
    const converted = ternary.replace(/'([^']*fa-(solid|regular|brands)[^']*)'/g, (m, fullClass) => {
      const faMatch = fullClass.match(/(fa-(?:solid|regular|brands))\s+(fa-[a-z0-9-]+)/)
      if (!faMatch) return m

      modified = true
      const [, style, icon] = faMatch
      const iconifyStyle = style.replace('fa-', 'fa6-')
      const iconName = icon.replace('fa-', '')

      // 提取其他 class (如 fa-spin)
      const otherClasses = fullClass.split(/\s+/)
        .filter(c => !c.match(/^fa-(solid|regular|brands)$/) && !c.match(/^fa-[a-z0-9-]+$/))
        .join(' ')

      return `'${iconifyStyle}:${iconName}${otherClasses ? ' ' + otherClasses : ''}'`
    })

    if (!modified) return match

    count++

    // 检查是否所有条件分支都成功转换
    if (converted.includes('fa-solid') || converted.includes('fa-regular') || converted.includes('fa-brands')) {
      return match // 转换不完整，保留原样
    }

    return `<Icon :name="${converted}" />`
  })

  // 模式 4: 带有 aria-hidden 的动态图标
  newContent = newContent.replace(/<i\s+:class="([^"]+)"\s+aria-hidden="true"\s*><\/i>/g, (match, classExpr) => {
    // 简单的条件表达式
    if (classExpr.includes('?') && classExpr.includes(':')) {
      const converted = classExpr.replace(/'([^']*fa-(solid|regular|brands)[^']*)'/g, (m, fullClass) => {
        const faMatch = fullClass.match(/(fa-(?:solid|regular|brands))\s+(fa-[a-z0-9-]+)/)
        if (!faMatch) return m

        const [, style, icon] = faMatch
        const iconifyStyle = style.replace('fa-', 'fa6-')
        const iconName = icon.replace('fa-', '')

        const otherClasses = fullClass.split(/\s+/)
          .filter(c => !c.match(/^fa-(solid|regular|brands)$/) && !c.match(/^fa-[a-z0-9-]+$/))
          .join(' ')

        return `'${iconifyStyle}:${iconName}${otherClasses ? ' ' + otherClasses : ''}'`
      })

      if (converted !== classExpr && !converted.includes('fa-solid') && !converted.includes('fa-regular')) {
        count++
        return `<Icon :name="${converted}" />`
      }
    }

    return match
  })

  return { newContent, count }
}

async function main() {
  console.log('🔄 开始处理复杂图标情况...\n')

  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      try {
        const content = await readFile(file, 'utf8')
        const { newContent, count } = replaceComplexIcons(content)

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
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

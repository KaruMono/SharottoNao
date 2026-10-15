#!/usr/bin/env node
/**
 * 处理动态 :class 绑定的图标
 * 将 <i :class="condition ? 'fa-solid fa-icon1' : 'fa-regular fa-icon2'"></i>
 * 转换为 <Icon :name="condition ? 'fa6-solid:icon1' : 'fa6-regular:icon2'" />
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
  } catch (e) {}
}

function convertFaClassToIconify(faClass) {
  // 'fa-solid fa-heart' -> 'fa6-solid:heart'
  const match = faClass.match(/(fa-(?:solid|regular|brands))\s+(fa-[a-z0-9-]+)/)
  if (!match) return null
  const [, style, icon] = match
  const iconifyStyle = style.replace('fa-', 'fa6-')
  const iconName = icon.replace('fa-', '')
  return `${iconifyStyle}:${iconName}`
}

function replaceDynamicIcons(content) {
  let newContent = content
  let count = 0

  // 模式 1: <i :class="condition ? 'fa-solid fa-icon1' : 'fa-solid fa-icon2'"></i>
  const ternaryPattern = /<i\s+:class="([^"]+\?[^"]+:[^"]+)"\s*(?:class="([^"]*)")?\s*><\/i>/g
  newContent = newContent.replace(ternaryPattern, (match, ternary, staticClass) => {
    // 尝试转换三元表达式中的 FA class
    const converted = ternary.replace(/'(fa-(?:solid|regular|brands)\s+fa-[a-z0-9-]+[^']*)'/g, (m, faClass) => {
      const iconify = convertFaClassToIconify(faClass)
      if (!iconify) return m

      // 提取额外的 class（如 text-green-500）
      const extraClasses = faClass.split(/\s+/).filter(c => !c.startsWith('fa-')).join(' ')

      return `'${iconify}'`
    })

    if (converted === ternary) return match // 没有转换成功

    count++

    // 构建新的 Icon 标签
    let result = `<Icon :name="${converted}"`
    if (staticClass) {
      result += ` class="${staticClass}"`
    }
    result += ` />`

    return result
  })

  // 模式 2: <i :class="variable || 'fa-solid fa-icon'"></i>
  const orPattern = /<i\s+:class="([^"]+\|\|[^"]+)"\s*(?:class="([^"]*)")?\s*><\/i>/g
  newContent = newContent.replace(orPattern, (match, orExpr, staticClass) => {
    // 尝试转换 || 表达式中的 FA class
    const converted = orExpr.replace(/'(fa-(?:solid|regular|brands)\s+fa-[a-z0-9-]+)'/g, (m, faClass) => {
      const iconify = convertFaClassToIconify(faClass)
      return iconify ? `'${iconify}'` : m
    })

    if (converted === orExpr) return match

    count++

    let result = `<Icon :name="${converted}"`
    if (staticClass) {
      result += ` class="${staticClass}"`
    }
    result += ` />`

    return result
  })

  // 模式 3: <Icon :class="{ 'fa-spin': loading }" /> (已经转换为 Icon 的)
  // 保持不变，这是正确的用法

  return { newContent, count }
}

async function main() {
  console.log('🔄 开始处理动态图标...\n')

  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      try {
        const content = await readFile(file, 'utf8')
        const { newContent, count } = replaceDynamicIcons(content)

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

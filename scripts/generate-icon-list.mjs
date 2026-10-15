#!/usr/bin/env node
/**
 * 扫描 Charlotte 项目中使用的 FontAwesome 图标，生成优化的图标列表
 *
 * 用法: node scripts/generate-icon-list.mjs
 */

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..') // Charlotte 根目录
const SCAN_DIRS = [
  join(ROOT, 'pages'),
  join(ROOT, 'components'),
  join(ROOT, 'layouts'),
  join(ROOT, 'app.vue')
]
const OUTPUT_FILE = join(ROOT, 'lib/icon.ts')

const SCAN_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.mjs'])
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', 'dist', '.git'])

// 手动添加的图标（代码中动态引用的）
const MANUAL_ICONS = []

// FontAwesome class 转换为 iconify 名称
// 例如: 'fa-solid fa-heart' -> 'fa6-solid:heart'
const FA_PATTERN = /['"]fa-(?:solid|regular|brands|light|duotone|thin)\s+fa-[a-z0-9-]+['"]/g

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
  } catch (e) {
    // 忽略单个文件的错误
  }
}

function convertFaClassToIconify(faClass) {
  // 'fa-solid fa-heart' -> 'fa6-solid:heart'
  const match = faClass.match(/fa-(solid|regular|brands|light|duotone|thin)\s+fa-([a-z0-9-]+)/)
  if (!match) return null
  const [, style, icon] = match
  return `fa6-${style}:${icon}`
}

async function main() {
  const found = new Set(MANUAL_ICONS)
  let scanned = 0

  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      scanned++
      try {
        const content = await readFile(file, 'utf8')

        // 扫描 FontAwesome class
        for (const match of content.matchAll(FA_PATTERN)) {
          const iconName = convertFaClassToIconify(match[0].slice(1, -1))
          if (iconName) {
            found.add(iconName)
          }
        }
      } catch (e) {
        console.warn(`Warning: Failed to read ${file}`)
      }
    }
  }

  const names = [...found].sort()
  const collections = [...new Set(names.map(n => n.split(':')[0]))].sort()

  const body = render(names, collections)
  await mkdir(dirname(OUTPUT_FILE), { recursive: true })
  await writeFile(OUTPUT_FILE, body)

  const rel = relative(ROOT, OUTPUT_FILE)
  console.log(
    `✅ 扫描了 ${scanned} 个文件，找到 ${names.length} 个图标，来自 ${collections.length} 个集合`
  )
  console.log(`📝 已写入 ${rel}`)

  if (names.length === 0) {
    console.warn('\n⚠️  未找到任何图标！请检查扫描路径和正则表达式')
  }
}

function render(names, collections) {
  const namesLines = names.map(n => `  '${n}'`).join(',\n')
  const collectionsLines = collections.map(c => `  '${c}'`).join(',\n')
  return `/**
 * 由 scripts/generate-icon-list.mjs 自动生成
 * 请勿手动编辑 — 更新图标使用后运行 \`npm run icons\`
 */
export const ICON_NAMES: string[] = [
${namesLines}
]

export const ICON_COLLECTIONS: string[] = [
${collectionsLines}
]
`
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

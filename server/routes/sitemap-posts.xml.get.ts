import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { urlEntry, wrapUrlset, sendSitemapXml } from '~/server/utils/sitemap'

type ContentPost = {
  path: string
  date?: string
  updatedAt?: string
}

function toSitemapDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().split('T')[0]
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const nested = await Promise.all(entries.map((entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) return listMarkdownFiles(fullPath)
      if (entry.isFile() && entry.name.endsWith('.md')) return [fullPath]
      return []
    }))
    return nested.flat()
  } catch {
    return []
  }
}

function frontmatterValue(content: string, key: 'date' | 'updatedAt') {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
}

async function readPosts(): Promise<ContentPost[]> {
  const postsDir = join(process.cwd(), 'content', 'posts')
  const files = await listMarkdownFiles(postsDir)

  return Promise.all(files.map(async (file) => {
    const content = await readFile(file, 'utf8')
    const slug = relative(postsDir, file)
      .replace(/\.md$/, '')
      .split(sep)
      .join('/')

    return {
      path: `/posts/${slug}`,
      date: frontmatterValue(content, 'date'),
      updatedAt: frontmatterValue(content, 'updatedAt'),
    }
  }))
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/+$/, '')

  const posts = await readPosts()
  const urls = posts.map((post) => {
    return urlEntry(`${siteUrl}${post.path}`, {
      lastmod: toSitemapDate(post.updatedAt || post.date),
      changefreq: 'monthly',
      priority: '0.7',
    })
  })

  return sendSitemapXml(event, wrapUrlset(urls))
})
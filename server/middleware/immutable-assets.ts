import { createReadStream, existsSync, lstatSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import {
  getHeader,
  getRequestURL,
  sendStream,
  setHeader,
  setResponseStatus,
} from 'h3'

/**
 * Optional shared static asset fallback.
 *
 * When CHARLOTTE_STATIC_ASSET_ROOT is configured, hashed Nuxt assets are read
 * from an immutable directory outside the release tree. This bypasses Nitro's
 * build-time asset manifest and keeps old hashes available during a rollout.
 * OpenResty should normally serve this directory directly; this handler is a
 * safe fallback for installations where the reverse proxy cannot do so.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const rootValue = String(config.staticAssetRoot || '').trim()
  if (!rootValue) return

  const pathname = getRequestURL(event).pathname
  if (!pathname.startsWith('/_nuxt/')) return

  let relativePath: string
  try {
    relativePath = decodeURIComponent(pathname.slice(1))
  } catch {
    return
  }

  const root = resolve(rootValue)
  const filePath = resolve(root, relativePath)
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return

  const requestedEncoding = extname(filePath) === '.br' || extname(filePath) === '.gz'
    ? null
    : chooseEncoding(getHeader(event, 'accept-encoding'))
  const candidates = requestedEncoding
    ? [`${filePath}.${requestedEncoding}`, filePath]
    : [filePath]

  const selectedPath = candidates.find(candidate => existsSync(candidate))
  if (!selectedPath) return

  let stat: ReturnType<typeof statSync>
  try {
    const linkStat = lstatSync(selectedPath)
    if (!linkStat.isFile() || linkStat.isSymbolicLink()) return
    stat = statSync(selectedPath)
  } catch {
    return
  }
  if (!stat.isFile()) return

  const encoding = selectedPath.endsWith('.br')
    ? 'br'
    : selectedPath.endsWith('.gz')
      ? 'gzip'
      : undefined
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`
  if (getHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return ''
  }

  const ifModifiedSince = getHeader(event, 'if-modified-since')
  if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= stat.mtimeMs) {
    setResponseStatus(event, 304)
    return ''
  }

  const sourceExt = relativePath.endsWith('.br') || relativePath.endsWith('.gz')
    ? extname(relativePath.slice(0, -3))
    : extname(relativePath)
  setHeader(event, 'Content-Type', contentTypeFor(sourceExt))
  setHeader(event, 'X-Charlotte-Asset-Source', 'shared')
  setHeader(event, 'Content-Length', stat.size)
  setHeader(event, 'ETag', etag)
  setHeader(event, 'Last-Modified', stat.mtime.toUTCString())
  setHeader(event, 'Cache-Control', pathname.startsWith('/_nuxt/builds/meta/')
    ? 'public, max-age=31536000, immutable'
    : pathname.startsWith('/_nuxt/builds/')
      ? 'public, max-age=1'
      : 'public, max-age=31536000, immutable')
  if (encoding) {
    setHeader(event, 'Content-Encoding', encoding)
    // Set one canonical value. Appending here can produce duplicate Vary
    // headers when a proxy or route rule already supplied the same token.
    setHeader(event, 'Vary', 'Accept-Encoding')
  }

  setResponseStatus(event, 200)
  return sendStream(event, createReadStream(selectedPath))
})

function chooseEncoding(value: string | undefined): 'br' | 'gz' | undefined {
  if (!value) return undefined
  const accepted = new Map<string, number>()
  for (const item of value.toLowerCase().split(',')) {
    const [name, ...params] = item.trim().split(';')
    if (!name) continue
    const quality = params.find(param => param.trim().startsWith('q='))?.trim().slice(2)
    const q = quality === undefined ? 1 : Number(quality)
    if (Number.isFinite(q) && q > 0) accepted.set(name, q)
  }
  const br = accepted.get('br') ?? accepted.get('*') ?? 0
  const gzip = accepted.get('gzip') ?? accepted.get('*') ?? 0
  if (br === 0 && gzip === 0) return undefined
  return br >= gzip ? 'br' : 'gz'
}

function contentTypeFor(extension: string): string {
  switch (extension.toLowerCase()) {
    case '.js': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.map': return 'application/json; charset=utf-8'
    case '.html': return 'text/html; charset=utf-8'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    default: return 'application/octet-stream'
  }
}

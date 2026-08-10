export interface AlistEntry {
  name: string
  is_dir: boolean
  size?: number
}

export interface AlistApiResponse<T> {
  code: number
  message?: string
  data?: T
}

export interface AlistFileInfo {
  name: string
  is_dir: boolean
  size?: number
}

export interface AlistListInfo {
  content?: AlistEntry[]
}

export function normalizeAlistBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function formatAlistSize(bytes: number): string {
  if (bytes <= 0) return '0M'

  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)}G`

  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)}M`
}

export async function fetchAlistApi<T>(
  baseUrl: string,
  token: string | null,
  endpoint: 'get' | 'list',
  body: Record<string, unknown>,
): Promise<AlistApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = token

  const response = await fetch(`${baseUrl}/api/fs/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  return response.json() as Promise<AlistApiResponse<T>>
}

export function resolveAlistPath(url: string): string {
  const urlObj = new URL(url)
  return decodeURIComponent(urlObj.pathname).replace(/^\/(d|p)\//, '/')
}
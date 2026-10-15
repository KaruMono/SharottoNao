import type { H3Event } from 'h3'
import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), fetch: vi.fn() }))
vi.mock('~/server/utils/auth', () => ({ requireAuth: mocks.requireAuth }))

let search: typeof import('../../api/animetrace/search.post').default
const request = (body: object) => ({ body }) as unknown as H3Event

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', (event: { body: unknown }) => event.body)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('fetch', mocks.fetch)
  search = (await import('../../api/animetrace/search.post')).default
})

afterAll(() => vi.unstubAllGlobals())

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAuth.mockResolvedValue({ id: 1 })
  mocks.fetch.mockResolvedValue(Response.json({ code: 0, data: [] }))
})

describe('AnimeTrace image search', () => {
  it('uploads large images as binary files to avoid the upstream 1MB text field limit', async () => {
    const bytes = Buffer.alloc(1200 * 1024, 0x5a)
    const result = { code: 0, data: [{ character: [{ work: 'Clover Days' }] }] }
    mocks.fetch.mockResolvedValue(Response.json(result))

    expect(await search(request({ file: bytes.toString('base64') }))).toEqual(result)
    expect(mocks.requireAuth).toHaveBeenCalledOnce()
    const [url, options] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://api.animetrace.com/v1/search')
    expect(options.method).toBe('POST')
    const form = options.body as FormData
    expect(form.has('base64')).toBe(false)
    const file = form.get('file') as File
    expect(file).toBeInstanceOf(Blob)
    expect(file.size).toBe(bytes.length)
    expect(Buffer.from(await file.arrayBuffer()).equals(bytes)).toBe(true)
    expect(form.get('is_multi')).toBe('true')
    expect(form.get('ai_detect')).toBe('false')
  })

  it('accepts data URLs without including their prefix in the file', async () => {
    await search(request({ file: 'data:image/png;base64,aGVsbG8=' }))
    const file = (mocks.fetch.mock.calls[0][1].body as FormData).get('file') as File
    expect(await file.text()).toBe('hello')
  })

  it('preserves URL-based searches', async () => {
    await search(request({ url: 'https://example.com/image.png', is_multi: false }))
    const form = mocks.fetch.mock.calls[0][1].body as FormData
    expect(form.get('url')).toBe('https://example.com/image.png')
    expect(form.has('file')).toBe(false)
    expect(form.get('is_multi')).toBe('false')
  })

  it('rejects images over 10MB before contacting the upstream', async () => {
    const file = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')
    await expect(search(request({ file }))).rejects.toMatchObject({ statusCode: 413 })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([{}, { file: 'data:image/png;base64,' }])('rejects missing or empty image data %j', async body => {
    await expect(search(request(body))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('requires authentication before uploading the image', async () => {
    mocks.requireAuth.mockRejectedValue(createError({ statusCode: 401 }))
    await expect(search(request({ file: 'aGVsbG8=' }))).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('retains the upstream explanation for HTTP 400 responses', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ detail: 'Part exceeded maximum size of 1024KB.' }, { status: 400 }))
    await expect(search(request({ file: 'aGVsbG8=' }))).rejects.toMatchObject({
      statusCode: 400, message: '图片识别请求失败: Part exceeded maximum size of 1024KB.',
    })
  })

  it('prefers the upstream Chinese explanation when available', async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      code: 17737, zh_message: '请求过于频繁，请稍后再试', detail: 'Too Many Requests',
    }, { status: 429 }))
    await expect(search(request({ file: 'aGVsbG8=' }))).rejects.toMatchObject({
      statusCode: 429, message: '图片识别请求失败: 请求过于频繁，请稍后再试',
    })
  })

  it('reports upstream HTTP failures even when the body is not JSON', async () => {
    mocks.fetch.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))
    await expect(search(request({ file: 'aGVsbG8=' }))).rejects.toMatchObject({
      statusCode: 502, message: '图片识别请求失败: HTTP 502',
    })
  })

  it('rejects non-JSON successful responses as invalid upstream responses', async () => {
    mocks.fetch.mockResolvedValue(new Response('<html>Maintenance</html>'))
    await expect(search(request({ file: 'aGVsbG8=' }))).rejects.toMatchObject({ statusCode: 502 })
  })

  it('accepts lowercase success messages used by the current API', async () => {
    const result = { code: 0, message: 'success', data: [] }
    mocks.fetch.mockResolvedValue(Response.json(result))
    expect(await search(request({ file: 'aGVsbG8=' }))).toEqual(result)
  })
})

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  clearSettingsCache: vi.fn(),
  requireAdmin: vi.fn(),
  uploadImage: vi.fn(),
  readBody: vi.fn(),
  readMultipartFormData: vi.fn(),
  setHeader: vi.fn(),
}))

vi.mock('~/server/utils/settings', () => mocks)
vi.mock('~/server/utils/auth', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('~/server/utils/storage', () => ({ uploadImage: mocks.uploadImage }))
vi.mock('~/utils/login-backgrounds', () => import('../../../utils/login-backgrounds'))

let getBackground: (event: any) => any
let saveSettings: (event: any) => any
let uploadBackground: (event: any) => any

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: any) => handler)
  vi.stubGlobal('setHeader', mocks.setHeader)
  vi.stubGlobal('readBody', mocks.readBody)
  vi.stubGlobal('readMultipartFormData', mocks.readMultipartFormData)
  vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.message), options))
  getBackground = (await import('../../api/login-background.get')).default
  saveSettings = (await import('../../api/admin/settings.put')).default
  uploadBackground = (await import('../../api/admin/upload-login-background.post')).default
})

beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('login background settings', () => {
  it('saves a normalized image pool and can clear it', async () => {
    mocks.readBody.mockResolvedValue({ login_background_images: ' /uploads/a.webp \r\n\nhttps://example.com/b.jpg\n/uploads/a.webp' })
    await saveSettings({})
    expect(mocks.setSetting).toHaveBeenCalledWith('login_background_images', '/uploads/a.webp\nhttps://example.com/b.jpg')
    expect(mocks.clearSettingsCache).toHaveBeenCalled()

    mocks.readBody.mockResolvedValue({ login_background_images: '' })
    await saveSettings({})
    expect(mocks.setSetting).toHaveBeenLastCalledWith('login_background_images', '')
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,abc', '//example.com/a.jpg', '/\\example.com/a.jpg', 'invalid', 'https://user:pass@example.com/a.jpg'])(
    'rejects invalid image URLs before writing any settings: %s', async url => {
      mocks.readBody.mockResolvedValue({ site_name: 'New name', login_background_images: url })
      await expect(saveSettings({})).rejects.toMatchObject({ statusCode: 400 })
      expect(mocks.setSetting).not.toHaveBeenCalled()
    },
  )

  it('requires an administrator before reading settings or uploaded files', async () => {
    mocks.requireAdmin.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }))
    await expect(saveSettings({})).rejects.toMatchObject({ statusCode: 403 })
    await expect(uploadBackground({})).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.readBody).not.toHaveBeenCalled()
    expect(mocks.readMultipartFormData).not.toHaveBeenCalled()
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })
})

describe('login background selection', () => {
  it.each([null, '', ' \n ', 'javascript:alert(1)'])('returns the default background for an empty or invalid pool', async value => {
    mocks.getSetting.mockResolvedValue(value)
    await expect(getBackground({})).resolves.toEqual({ imageUrl: '' })
  })

  it('samples the configured images again on each request without caching the choice', async () => {
    mocks.getSetting.mockResolvedValue('/uploads/a.webp\nhttps://example.com/b.jpg\n/uploads/c.webp')
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.999999)
    const event = {}
    const results = [await getBackground(event), await getBackground(event), await getBackground(event)]
    expect(results.map(result => result.imageUrl)).toEqual(['/uploads/a.webp', 'https://example.com/b.jpg', '/uploads/c.webp'])
    expect(mocks.setHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })
})

describe('login background uploads', () => {
  it('stores uploaded backgrounds outside resource image cleanup', async () => {
    const data = Buffer.from('image bytes')
    mocks.readMultipartFormData.mockResolvedValue([{ name: 'file', type: 'image/png', filename: 'sample.png', data }])
    mocks.uploadImage.mockResolvedValue({ url: '/uploads/login-backgrounds/sample.webp' })
    await expect(uploadBackground({})).resolves.toEqual({ url: '/uploads/login-backgrounds/sample.webp' })
    expect(mocks.uploadImage).toHaveBeenCalledWith(data, 'sample.png', { folder: 'login-backgrounds' })
  })

  it.each([
    null,
    [{ name: 'file', type: 'text/html', data: Buffer.from('<html>') }],
    [{ name: 'file', type: 'image/png', data: Buffer.alloc(10 * 1024 * 1024 + 1) }],
  ])('rejects missing, unsupported, or oversized uploads', async files => {
    mocks.readMultipartFormData.mockResolvedValue(files)
    await expect(uploadBackground({})).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanVndbDescription,
  fetchVndbGame,
  mapVndbResult,
  normalizeVndbId,
  toPublicVndbGameData,
  VndbClientError,
} from '../vndb-client'

function upstreamResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v123',
    title: 'Primary title',
    titles: [
      { title: 'English title', lang: 'en', latin: null },
      { title: '日本語タイトル', lang: 'ja', latin: 'Nihongo Title' },
    ],
    aliases: ['English title', 'Alternate title'],
    released: '2026-08-16',
    description: '[b]Story[/b] [url=https://example.com]source[/url]',
    image: { url: 'https://images.example/cover.jpg', sexual: 0, violence: 0 },
    tags: [
      { id: 'g10', name: 'School Life', rating: 2.4, spoiler: 0 },
    ],
    length_minutes: 720,
    staff: [
      { name: 'Writer', original: null, role: 'scenario', note: null },
      { name: 'Ignored', original: null, role: 'translator', note: null },
    ],
    developers: [{ name: 'Studio', original: 'スタジオ' }],
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('VNDB client mapping', () => {
  it('normalizes IDs and reports client errors without a Nuxt runtime', () => {
    expect(normalizeVndbId(' V123 ')).toBe('v123')

    try {
      normalizeVndbId('123')
      throw new Error('expected normalizeVndbId to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(VndbClientError)
      expect(error).toMatchObject({ statusCode: 400 })
    }
  })

  it('preserves raw tag metadata while mapping titles, aliases, and staff', () => {
    const mapped = mapVndbResult(upstreamResult())

    expect(mapped).toMatchObject({
      vndbId: 'v123',
      titleEn: 'English title',
      titleJa: '日本語タイトル',
      aliases: ['Primary title', 'Nihongo Title', 'Alternate title'],
      descriptionEn: 'Story source',
      lengthMinutes: 720,
      tags: [{ id: 'g10', name: 'School Life', rating: 2.4, spoiler: 0 }],
      staff: [{ name: 'Writer', nameOriginal: null, role: 'WRITER', characterName: null }],
      developers: [{ name: 'Studio', nameOriginal: 'スタジオ' }],
    })
    expect(mapped.isNsfw).toBe(false)
  })

  it('deduplicates repeated VNDB staff credits by the database key', () => {
    const mapped = mapVndbResult(upstreamResult({
      staff: [
        { name: 'Writer', original: null, role: 'scenario', note: null },
        { name: 'Writer', original: null, role: 'scenario', note: null },
        { name: 'Writer', original: null, role: 'director', note: null },
      ],
    }))

    expect(mapped.staff).toEqual([
      { name: 'Writer', nameOriginal: null, role: 'WRITER', characterName: null },
      { name: 'Writer', nameOriginal: null, role: 'DIRECTOR', characterName: null },
    ])
  })

  it('removes raw tag names from public VNDB lookup responses', () => {
    const publicData = toPublicVndbGameData(mapVndbResult(upstreamResult({
      tags: [{ id: 'g235', name: 'Sexual Content', rating: 2.5, spoiler: 0 }],
    })))

    expect(publicData).not.toHaveProperty('tags')
    expect(JSON.stringify(publicData)).not.toContain('Sexual Content')
    expect(publicData.isNsfw).toBe(true)
  })

  it('uses known adult tags as a conservative game-level signal', () => {
    const mapped = mapVndbResult(upstreamResult({
      tags: [{ id: 'g235', name: 'Sexual Content', rating: 1.5, spoiler: 0 }],
    }))

    expect(mapped.isNsfw).toBe(true)
  })

  it('uses VNDB ero category as the authoritative adult signal', () => {
    const mapped = mapVndbResult(upstreamResult({
      tags: [{
        id: 'g999',
        name: 'New adult tag',
        category: 'ero',
        rating: 1.5,
        spoiler: 0,
      }],
    }))

    expect(mapped.isNsfw).toBe(true)
    expect(mapped.tags[0]).toMatchObject({ id: 'g999', category: 'ero' })
  })

  it('requests the full VNDB tag payload used by synchronization', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [upstreamResult()] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchVndbGame('v123')
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(request.body))

    expect(body.filters).toEqual(['id', '=', 'v123'])
    expect(body.fields).toContain('tags{id,name,rating,spoiler,category}')
    expect(result.tags).toEqual([
      { id: 'g10', name: 'School Life', rating: 2.4, spoiler: 0 },
    ])
  })

  it('honors Retry-After before retrying a rate-limited request', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '2' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [upstreamResult()] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchVndbGame('v123')
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(request).resolves.toMatchObject({ vndbId: 'v123' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses bounded exponential retries for VNDB server errors', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchVndbGame('v123')
    const rejection = expect(request).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'VNDB API 请求失败',
    })

    await vi.advanceTimersByTimeAsync(499)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)

    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries network failures but stops after three attempts', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const networkError = new TypeError('connection reset')
    const fetchMock = vi.fn().mockRejectedValue(networkError)
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchVndbGame('v123')
    const rejection = expect(request).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'VNDB API 请求失败，请稍后重试',
    })
    await vi.runAllTimersAsync()

    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('aborts stalled response bodies after the per-attempt timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal
      signals.push(signal)

      return {
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          }, { once: true })
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchVndbGame('v123')
    const rejection = expect(request).rejects.toMatchObject({ statusCode: 502 })
    await vi.runAllTimersAsync()

    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })
})

describe('VNDB description cleanup', () => {
  it('removes supported VNDB markup without dropping its text', () => {
    expect(cleanVndbDescription('[spoiler][i]text[/i][/spoiler]')).toBe('text')
    expect(cleanVndbDescription(null)).toBeNull()
  })
})

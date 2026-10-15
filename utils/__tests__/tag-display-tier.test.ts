import { describe, expect, it } from 'vitest'
import type { GameDetailTag } from '../../types/api'
import { groupGameDetailTags, resolveGameTagDisplayTier } from '../tag-display-tier'

function tag(id: number, overrides: Partial<GameDetailTag> = {}): GameDetailTag {
  return { id, name: `tag-${id}`, ...overrides }
}

describe('groupGameDetailTags', () => {
  it('returns non-empty groups in primary, secondary, R18 order', () => {
    const groups = groupGameDetailTags([
      tag(1, { isNsfw: true, displayTier: 'SECONDARY' }),
      tag(2, { displayTier: 'SECONDARY' }),
      tag(3, { displayTier: 'PRIMARY' }),
    ])

    expect(groups.map(group => group.label)).toEqual(['标签', '副标签', 'R18 标签'])
    expect(groups.map(group => group.tags.map(item => item.id))).toEqual([[3], [2], [1]])
  })

  it('treats tags from old payloads without a tier as primary', () => {
    expect(groupGameDetailTags([tag(1)]).map(group => group.kind)).toEqual(['primary'])
  })

  it('lets the R18 classification override the display tier', () => {
    const groups = groupGameDetailTags([
      tag(1, { isNsfw: true, displayTier: 'PRIMARY' }),
      tag(2, { isNsfw: true, displayTier: 'SECONDARY' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.kind).toBe('nsfw')
    expect(groups[0]?.tags.map(item => item.id)).toEqual([1, 2])
  })

  it('omits empty groups', () => {
    expect(groupGameDetailTags([])).toEqual([])
  })
})

describe('resolveGameTagDisplayTier', () => {
  it('uses secondary only when all associations are secondary VNDB sources', () => {
    expect(resolveGameTagDisplayTier([
      { source: 'VNDB', displayTier: 'SECONDARY' },
      { source: 'VNDB', displayTier: 'SECONDARY' },
    ])).toBe('SECONDARY')
  })

  it('keeps tags with no source metadata primary', () => {
    expect(resolveGameTagDisplayTier([])).toBe('PRIMARY')
  })

  it('lets any primary VNDB association override a secondary one', () => {
    expect(resolveGameTagDisplayTier([
      { source: 'VNDB', displayTier: 'SECONDARY' },
      { source: 'VNDB', displayTier: 'PRIMARY' },
    ])).toBe('PRIMARY')
  })

  it.each(['MANUAL', 'SYSTEM'] as const)(
    'keeps a tag primary when it has an abnormal secondary %s source',
    (source) => {
      expect(resolveGameTagDisplayTier([
        { source: 'VNDB', displayTier: 'SECONDARY' },
        { source, displayTier: 'SECONDARY' },
      ])).toBe('PRIMARY')
    },
  )
})

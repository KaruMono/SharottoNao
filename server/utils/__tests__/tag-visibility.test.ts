import { describe, expect, it } from 'vitest'
import {
  buildGameTagVisibilityWhere,
  buildTagVisibilityWhere,
  isTagVisible,
  mergeRequestedTagIdsPreservingHidden,
} from '../tag-visibility'

describe('tag visibility', () => {
  it('hides adult and archived labels in SFW mode', () => {
    expect(isTagVisible({ isNsfw: false, archivedAt: null }, 'SFW')).toBe(true)
    expect(isTagVisible({ isNsfw: true, archivedAt: null }, 'SFW')).toBe(false)
    expect(isTagVisible({ isNsfw: false, archivedAt: new Date() }, 'SFW')).toBe(false)
  })

  it('allows adult labels outside SFW mode but still hides archived labels', () => {
    expect(isTagVisible({ isNsfw: true, archivedAt: null }, 'NSFW')).toBe(true)
    expect(isTagVisible({ isNsfw: true, archivedAt: new Date() }, 'ALL')).toBe(false)
    expect(isTagVisible(
      { isNsfw: true, archivedAt: new Date() },
      'ALL',
      { includeArchived: true },
    )).toBe(true)
  })

  it('builds reusable Prisma filters for top-level and nested tag queries', () => {
    expect(buildTagVisibilityWhere('SFW')).toEqual({ archivedAt: null, isNsfw: false })
    expect(buildTagVisibilityWhere('ALL')).toEqual({ archivedAt: null })
    expect(buildGameTagVisibilityWhere('SFW')).toEqual({
      tag: { archivedAt: null, isNsfw: false },
    })
  })

  it('preserves hidden existing tags when a full-form edit is submitted', () => {
    const existing = [
      { tagId: 1, tag: { isNsfw: false, archivedAt: null } },
      { tagId: 2, tag: { isNsfw: true, archivedAt: null } },
      { tagId: 3, tag: { isNsfw: false, archivedAt: new Date() } },
    ]

    expect(mergeRequestedTagIdsPreservingHidden([1, 4], existing, 'SFW'))
      .toEqual([1, 2, 3, 4])
    expect(mergeRequestedTagIdsPreservingHidden([4], existing, 'ALL'))
      .toEqual([3, 4])
  })
})

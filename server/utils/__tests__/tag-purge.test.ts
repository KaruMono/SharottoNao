import { VndbTagStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  purgeArchivedTagsInTransaction,
  TagPurgeRejectedError,
} from '../tag-purge'

function createTransaction(lockedTags: Array<{
  id: number
  name: string
  isSystem: boolean
  archivedAt: Date | null
}>) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue(lockedTags),
    gameTag: {
      count: vi.fn().mockResolvedValue(4),
    },
    vndbTag: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    gameVndbTag: {
      deleteMany: vi.fn(),
    },
    tag: {
      deleteMany: vi.fn().mockResolvedValue({ count: lockedTags.length }),
    },
  }
}

describe('archived tag purge transaction', () => {
  it('resets VNDB mappings, removes canonical tags, and preserves raw associations', async () => {
    const tx = createTransaction([
      { id: 3, name: '校园', isSystem: false, archivedAt: new Date() },
      { id: 8, name: '纯爱', isSystem: false, archivedAt: new Date() },
    ])

    await expect(purgeArchivedTagsInTransaction(tx as never, [8, 3, 8])).resolves.toEqual({
      purgedCount: 2,
      removedGameAssociations: 4,
      resetVndbMappings: 2,
    })
    expect(tx.$executeRaw.mock.invocationCallOrder[0])
      .toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[0])
    expect(tx.gameTag.count).toHaveBeenCalledWith({
      where: { tagId: { in: [3, 8] } },
    })
    expect(tx.vndbTag.updateMany).toHaveBeenCalledWith({
      where: { tagId: { in: [3, 8] } },
      data: { tagId: null, status: VndbTagStatus.PENDING },
    })
    expect(tx.tag.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [3, 8] } },
    })
    expect(tx.gameVndbTag.deleteMany).not.toHaveBeenCalled()
  })

  it('rejects a missing tag before changing associations', async () => {
    const tx = createTransaction([])

    const rejection = purgeArchivedTagsInTransaction(tx as never, [12])
    await expect(rejection).rejects.toBeInstanceOf(TagPurgeRejectedError)
    await expect(rejection).rejects.toMatchObject({
      reason: 'missing',
      tagId: 12,
      statusCode: 404,
    })
    expect(tx.vndbTag.updateMany).not.toHaveBeenCalled()
    expect(tx.tag.deleteMany).not.toHaveBeenCalled()
  })

  it.each([
    {
      state: { id: 5, name: '系统标签', isSystem: true, archivedAt: new Date() },
      reason: 'system',
    },
    {
      state: { id: 5, name: '使用中标签', isSystem: false, archivedAt: null },
      reason: 'active',
    },
  ] as const)('rejects a $reason tag before changing associations', async ({ state, reason }) => {
    const tx = createTransaction([state])

    const rejection = purgeArchivedTagsInTransaction(tx as never, [5])
    await expect(rejection).rejects.toBeInstanceOf(TagPurgeRejectedError)
    await expect(rejection).rejects.toMatchObject({
      reason,
      tagId: 5,
      statusCode: 409,
    })
    expect(tx.gameTag.count).not.toHaveBeenCalled()
    expect(tx.vndbTag.updateMany).not.toHaveBeenCalled()
    expect(tx.tag.deleteMany).not.toHaveBeenCalled()
  })
})

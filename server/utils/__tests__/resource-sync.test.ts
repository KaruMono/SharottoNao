import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncPublishedResource, type ResourceSyncPayload } from '../resource-sync'

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    resourceType: { findUnique: vi.fn() },
    game: { findUnique: vi.fn(), update: vi.fn() },
    resource: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: { game: { create: vi.fn() } },
  fetchVndbGame: vi.fn(),
  markImageAsUsed: vi.fn(),
  recordActivity: vi.fn(),
  submitGameToIndexNow: vi.fn(),
  updateMachineTranslationTag: vi.fn(),
  invalidateGameCaches: vi.fn(),
  lockVndbTagSyncInTransaction: vi.fn(),
  syncVndbTagsForGameInTransaction: vi.fn(),
}))

vi.mock('~/server/utils/prisma', () => ({ default: mocks.prisma }))
vi.mock('~/server/utils/image', () => ({ markImageAsUsed: mocks.markImageAsUsed }))
vi.mock('~/server/utils/activity', () => ({ recordActivity: mocks.recordActivity }))
vi.mock('~/server/utils/indexnow', () => ({ submitGameToIndexNow: mocks.submitGameToIndexNow }))
vi.mock('~/server/utils/machine-translation-tag', () => ({ updateMachineTranslationTag: mocks.updateMachineTranslationTag }))
vi.mock('~/server/utils/redis', () => ({ invalidateGameCaches: mocks.invalidateGameCaches }))
vi.mock('~/server/utils/vndb-client', () => ({ fetchVndbGame: mocks.fetchVndbGame }))
vi.mock('~/server/utils/game-staff', () => ({ ensureGameStaffRelation: vi.fn() }))
vi.mock('~/server/utils/vndb-tag-sync', () => ({
  lockVndbTagSyncInTransaction: mocks.lockVndbTagSyncInTransaction,
  syncVndbTagsForGameInTransaction: mocks.syncVndbTagsForGameInTransaction,
}))

const game = {
  id: 42,
  vndbId: 'v123',
  titleZhHans: '原有游戏标题',
  deletedAt: null,
}

const payload: ResourceSyncPayload = {
  vndbId: 'V123',
  title: '下载资源',
  url: 'https://example.com/download',
  typeId: 2,
  language: 'zh-Hans',
  fileSize: '1.2G',
}

function uniqueConflict(target = 'vndbId', modelName = 'Game') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { modelName, target: [target] },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.prisma.user.findUnique.mockResolvedValue({ id: 1 })
  mocks.prisma.resourceType.findUnique.mockResolvedValue({ id: 2 })
  mocks.prisma.game.findUnique.mockResolvedValue(game)
  mocks.prisma.game.update.mockResolvedValue(game)
  mocks.prisma.resource.findFirst.mockResolvedValue(null)
  mocks.prisma.resource.create.mockResolvedValue({ id: 100 })
  mocks.prisma.resource.update.mockResolvedValue({ id: 100 })
  mocks.prisma.$transaction.mockImplementation(callback => callback(mocks.tx))
  mocks.tx.game.create.mockResolvedValue(game)
  mocks.fetchVndbGame.mockResolvedValue({ vndbId: 'v123', titleEn: 'VNDB title', tags: [] })
  mocks.submitGameToIndexNow.mockResolvedValue(undefined)
  mocks.invalidateGameCaches.mockResolvedValue(undefined)
  mocks.updateMachineTranslationTag.mockResolvedValue(undefined)
})

describe('resource sync game resolution', () => {
  it('restores a trashed game before attaching the resource to its original ID', async () => {
    mocks.prisma.game.findUnique.mockResolvedValue({ ...game, deletedAt: new Date() })
    mocks.prisma.resource.create.mockImplementation(async () => {
      expect(mocks.prisma.game.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { deletedAt: null },
      })
      return { id: 100 }
    })

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).resolves.toMatchObject({
      ok: true, gameId: 42, resourceId: '100', action: 'created',
    })

    expect(mocks.prisma.game.findUnique).toHaveBeenCalledWith({ where: { vndbId: 'v123' } })
    expect(mocks.prisma.resource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ gameId: 42, title: payload.title }),
    })
    expect(mocks.fetchVndbGame).not.toHaveBeenCalled()
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
    expect(mocks.invalidateGameCaches).toHaveBeenCalledWith(42)
    expect(mocks.submitGameToIndexNow).toHaveBeenCalledWith(42, 'ADD')
  })

  it('updates an existing resource when its game is restored', async () => {
    mocks.prisma.game.findUnique.mockResolvedValue({ ...game, deletedAt: new Date() })
    mocks.prisma.resource.findFirst.mockResolvedValue({ id: 100 })

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).resolves.toMatchObject({
      gameId: 42, resourceId: '100', action: 'updated',
    })

    expect(mocks.prisma.resource.update).toHaveBeenCalledWith({
      where: { id: 100 }, data: expect.objectContaining({ gameId: 42 }),
    })
    expect(mocks.prisma.resource.create).not.toHaveBeenCalled()
  })

  it('reuses an active game without restoring or fetching it again', async () => {
    await expect(syncPublishedResource(payload, { uploaderId: 1 })).resolves.toMatchObject({ gameId: 42 })

    expect(mocks.prisma.game.update).not.toHaveBeenCalled()
    expect(mocks.fetchVndbGame).not.toHaveBeenCalled()
    expect(mocks.submitGameToIndexNow).not.toHaveBeenCalled()
  })

  it('still creates a game from VNDB when the ID does not exist', async () => {
    mocks.prisma.game.findUnique.mockResolvedValue(null)

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).resolves.toMatchObject({ gameId: 42 })

    expect(mocks.fetchVndbGame).toHaveBeenCalledWith('v123')
    expect(mocks.tx.game.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vndbId: 'v123', titleEn: 'VNDB title' }),
    })
    expect(mocks.syncVndbTagsForGameInTransaction).toHaveBeenCalledWith(mocks.tx, { gameId: 42, tags: [] })
    expect(mocks.prisma.game.update).not.toHaveBeenCalled()
  })

  it('lets concurrent syncs reuse the game that won the creation race', async () => {
    mocks.prisma.game.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mocks.tx.game.create.mockResolvedValueOnce(game).mockRejectedValueOnce(uniqueConflict())

    const results = await Promise.all([
      syncPublishedResource(payload, { uploaderId: 1 }),
      syncPublishedResource({ ...payload, title: '另一资源', url: 'https://example.com/another' }, { uploaderId: 1 }),
    ])

    expect(results.map(result => result.gameId)).toEqual([42, 42])
    expect(mocks.prisma.game.findUnique).toHaveBeenCalledTimes(3)
    expect(mocks.syncVndbTagsForGameInTransaction).toHaveBeenCalledTimes(1)
    expect(mocks.submitGameToIndexNow).toHaveBeenCalledTimes(1)
  })

  it('also restores a trashed game found after a creation conflict', async () => {
    mocks.prisma.game.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...game, deletedAt: new Date() })
    mocks.tx.game.create.mockRejectedValue(uniqueConflict())

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).resolves.toMatchObject({ gameId: 42 })

    expect(mocks.prisma.game.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { deletedAt: null } })
    expect(mocks.syncVndbTagsForGameInTransaction).not.toHaveBeenCalled()
    expect(mocks.submitGameToIndexNow).toHaveBeenCalledWith(42, 'ADD')
  })

  it.each([
    ['another unique field', uniqueConflict('bangumiId')],
    ['another model', uniqueConflict('vndbId', 'Staff')],
    ['an upstream failure', new Error('VNDB unavailable')],
  ])('does not hide %s', async (_label, error) => {
    mocks.prisma.game.findUnique.mockResolvedValueOnce(null)
    mocks.tx.game.create.mockRejectedValue(error)

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).rejects.toBe(error)

    expect(mocks.prisma.game.findUnique).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.resource.create).not.toHaveBeenCalled()
  })

  it('preserves the conflict if the competing game cannot be found', async () => {
    const error = uniqueConflict()
    mocks.prisma.game.findUnique.mockResolvedValue(null)
    mocks.tx.game.create.mockRejectedValue(error)

    await expect(syncPublishedResource(payload, { uploaderId: 1 })).rejects.toBe(error)

    expect(mocks.prisma.resource.create).not.toHaveBeenCalled()
  })
})

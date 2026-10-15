import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('../prisma', () => ({
  default: {
    tag: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}))

import { findSimilarTags, findTagByName } from '../tag-normalize'

describe('tag lookup by canonical name or alias', () => {
  beforeEach(() => vi.clearAllMocks())

  it('looks up an exact normalized alias alongside the canonical name', async () => {
    mocks.findFirst.mockResolvedValue({ id: 1, name: '校园生活' })

    await findTagByName(' Ｓｃｈｏｏｌ　Ｌｉｆｅ ')

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { name: { equals: 'School Life', mode: 'insensitive' } },
          { aliases: { some: { normalizedName: 'school life' } } },
        ],
      }),
    }))
  })

  it('includes aliases in similarity suggestions', async () => {
    mocks.findMany.mockResolvedValue([])

    await findSimilarTags('School')

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { name: { contains: 'School', mode: 'insensitive' } },
          { aliases: { some: { name: { contains: 'School', mode: 'insensitive' } } } },
        ],
      }),
    }))
  })
})

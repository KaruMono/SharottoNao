import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  buildTagNameConflictWhere,
  findTagNameConflict,
  InvalidCanonicalTagNameError,
  isPrismaUniqueConstraintError,
  prepareTagNames,
  resolveOrCreateTagByNameInTransaction,
  TagUnavailableError,
} from '../tag-name'

describe('tag name preparation', () => {
  it('normalizes canonical names and deduplicates aliases within a tag', () => {
    expect(prepareTagNames(' ＮＴＲ ', [
      'ntr',
      ' Netorare ',
      'netorare',
      '　寝取られ　',
      '---',
    ])).toEqual({
      name: 'NTR',
      normalizedName: 'ntr',
      aliases: [
        { name: 'Netorare', normalizedName: 'netorare' },
        { name: '寝取られ', normalizedName: '寝取られ' },
      ],
    })
  })

  it('rejects a canonical name that becomes empty after normalization', () => {
    expect(() => prepareTagNames('---', [])).toThrow(InvalidCanonicalTagNameError)
  })
})

describe('tag namespace conflicts', () => {
  it('rejects a canonical name occupied by another alias', () => {
    const conflict = findTagNameConflict(
      prepareTagNames('校园生活', []),
      { tagNames: [], aliasNames: ['校园生活'] },
    )
    expect(conflict).toEqual({
      field: 'name',
      value: '校园生活',
      occupiedBy: 'alias',
    })
  })

  it('rejects aliases occupied by another canonical name or alias', () => {
    expect(findTagNameConflict(
      prepareTagNames('校园生活', ['School Life']),
      { tagNames: ['school life'], aliasNames: [] },
    )).toEqual({
      field: 'alias',
      value: 'School Life',
      occupiedBy: 'tag',
    })

    expect(findTagNameConflict(
      prepareTagNames('校园生活', ['学园生活']),
      { tagNames: [], aliasNames: ['学园生活'] },
    )).toEqual({
      field: 'alias',
      value: '学园生活',
      occupiedBy: 'alias',
    })
  })

  it('builds update filters that exclude only the current tag', () => {
    const where = buildTagNameConflictWhere(
      prepareTagNames('校园生活', ['School Life']),
      42,
    )
    expect(where.tags).toMatchObject({ id: { not: 42 } })
    expect(where.aliases).toMatchObject({ tagId: { not: 42 } })
  })

  it('identifies Prisma unique constraint failures without importing runtime internals', () => {
    expect(isPrismaUniqueConstraintError({ code: 'P2002' })).toBe(true)
    expect(isPrismaUniqueConstraintError({ code: 'P2025' })).toBe(false)
    expect(isPrismaUniqueConstraintError(null)).toBe(false)
  })

  it('resolves free text through an existing alias instead of creating a duplicate tag', async () => {
    const existing = { id: 7, name: '校园生活' }
    const findFirst = vi.fn().mockResolvedValue(existing)
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      tag: { findFirst },
    } as unknown as Prisma.TransactionClient

    await expect(resolveOrCreateTagByNameInTransaction(tx, {
      name: 'School Life',
    })).resolves.toEqual({ tag: existing, created: false })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { equals: 'School Life', mode: 'insensitive' } },
          { aliases: { some: { normalizedName: 'school life' } } },
        ],
      },
    })
  })

  it.each([
    { archivedAt: new Date(), isSystem: false },
    { archivedAt: null, isSystem: true },
  ])('rejects archived and system tags during free-text resolution', async (state) => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      tag: {
        findFirst: vi.fn().mockResolvedValue({ id: 9, name: '机器翻译', ...state }),
      },
    } as unknown as Prisma.TransactionClient

    await expect(resolveOrCreateTagByNameInTransaction(tx, {
      name: '机器翻译',
    })).rejects.toBeInstanceOf(TagUnavailableError)
  })
})

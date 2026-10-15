import { describe, expect, it, vi } from 'vitest'
import { ensureGameStaffRelation } from '../game-staff'

describe('game staff relation writes', () => {
  it('uses the compound primary key to make duplicate credits idempotent', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    const create = vi.fn()
    const client = { gameStaff: { upsert, create } } as never
    const input = {
      gameId: 7,
      staffId: 11,
      role: 'WRITER',
      characterName: null,
    }

    await ensureGameStaffRelation(client, input)
    await ensureGameStaffRelation(client, input)

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenLastCalledWith({
      where: {
        gameId_staffId_role: {
          gameId: 7,
          staffId: 11,
          role: 'WRITER',
        },
      },
      update: {},
      create: {
        gameId: 7,
        staffId: 11,
        role: 'WRITER',
        characterName: null,
      },
    })
    expect(create).not.toHaveBeenCalled()
  })
})

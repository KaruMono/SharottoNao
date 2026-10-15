import type { Prisma, StaffRole } from '@prisma/client'

type GameStaffClient = Pick<Prisma.TransactionClient, 'gameStaff'>

export interface EnsureGameStaffRelationInput {
  gameId: number
  staffId: number
  role: string
  characterName?: string | null
}

/**
 * Add a staff credit without raising P2002 when the same credit is supplied
 * by both a form and an external data source. Existing metadata is preserved.
 */
export async function ensureGameStaffRelation(
  client: GameStaffClient,
  input: EnsureGameStaffRelationInput,
): Promise<void> {
  const role = input.role as StaffRole

  await client.gameStaff.upsert({
    where: {
      gameId_staffId_role: {
        gameId: input.gameId,
        staffId: input.staffId,
        role,
      },
    },
    update: {},
    create: {
      gameId: input.gameId,
      staffId: input.staffId,
      role,
      characterName: input.characterName || null,
    },
  })
}

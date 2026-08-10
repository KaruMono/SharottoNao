import { requireAdmin } from '~/server/utils/auth'
import { getStaleMachineTranslationTagGames } from '~/server/utils/machine-translation-tag'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const games = await getStaleMachineTranslationTagGames()
  return { count: games.length, games }
})

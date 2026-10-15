import { fetchVndbGame, toPublicVndbGameData } from '~/server/utils/vndb-client'

export default defineEventHandler(async (event) => {
  const vndbId = getRouterParam(event, 'id')
  if (!vndbId) {
    throw createError({ statusCode: 400, message: 'VNDB ID 不能为空' })
  }

  return toPublicVndbGameData(await fetchVndbGame(vndbId))
})

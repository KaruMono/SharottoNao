import { getAuthUser } from '~/server/utils/auth'
import { resolveAvatar } from '~/server/utils/gravatar'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未登录',
    })
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: await resolveAvatar(user.avatar, user.email),
    role: user.role,
    nsfwMode: user.nsfwMode,
  }
})

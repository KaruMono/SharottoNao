import { getSetting } from '~/server/utils/settings'
import { isLoginBackgroundUrl, parseLoginBackgrounds } from '~/utils/login-backgrounds'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const images = parseLoginBackgrounds(await getSetting('login_background_images'))
    .filter(isLoginBackgroundUrl)

  return { imageUrl: images[Math.floor(Math.random() * images.length)] || '' }
})

import crypto from 'crypto'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CAPTCHA_TTL = 5 * 60 * 1000 // 5 分钟有效

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min
}

/** 用 authSecret 对 text+expires 做 HMAC-SHA256 签名，返回 hex */
function sign(text: string, expires: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${text}:${expires}`)
    .digest('hex')
}

/** 生成干扰效果的 SVG 验证码 */
function generateSvgCaptcha(text: string): string {
  const W = 140
  const H = 44
  const fontSize = 26

  // 随机背景色（浅色系）
  const bgR = randomInt(230, 250)
  const bgG = randomInt(230, 250)
  const bgB = randomInt(230, 250)

  // SVG 湍流滤镜（让整体轻微扭曲）
  const turbFreq = randomFloat(0.035, 0.06).toFixed(3)
  const turbSeed = randomInt(1, 100)
  const filters = `
    <defs>
      <filter id="distort">
        <feTurbulence type="turbulence" baseFrequency="${turbFreq}" numOctaves="2" seed="${turbSeed}" result="turb"/>
        <feDisplacementMap in="SourceGraphic" in2="turb" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`

  // 背景噪点（更多、更密）
  const noiseRects: string[] = []
  for (let i = 0; i < 160; i++) {
    const x = randomInt(0, W)
    const y = randomInt(0, H)
    const w = randomInt(1, 4)
    const h = randomInt(1, 4)
    const op = randomFloat(0.08, 0.45).toFixed(2)
    const r = randomInt(0, 220)
    const g = randomInt(0, 220)
    const b = randomInt(0, 220)
    noiseRects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgb(${r},${g},${b})" opacity="${op}"/>`)
  }

  // 干扰线（更多、更粗、带曲线）
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const x1 = randomInt(0, W * 0.3)
    const y1 = randomInt(0, H)
    const x2 = randomInt(W * 0.7, W)
    const y2 = randomInt(0, H)
    // 贝塞尔曲线控制点
    const cx = randomInt(W * 0.2, W * 0.8)
    const cy = randomInt(0, H)
    const r = randomInt(40, 180)
    const g = randomInt(40, 180)
    const b = randomInt(40, 180)
    const sw = randomFloat(1, 2.5).toFixed(1)
    lines.push(`<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" stroke="rgb(${r},${g},${b})" stroke-width="${sw}" fill="none" opacity="0.6"/>`)
  }

  // 穿越字符的横向干扰线
  for (let i = 0; i < 3; i++) {
    const y = randomInt(H * 0.3, H * 0.7)
    const r = randomInt(80, 200)
    const g = randomInt(80, 200)
    const b = randomInt(80, 200)
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${randomInt(H * 0.3, H * 0.7)}" stroke="rgb(${r},${g},${b})" stroke-width="1" opacity="0.45"/>`)
  }

  // 字符：随机间距、旋转、纵向抖动、字号微变、随机字体
  const fonts = ['Arial', 'Verdana', 'Tahoma', 'Georgia', 'Impact']
  const chars: string[] = []
  // 不规律分布 x 坐标
  const totalPad = 16
  const span = W - totalPad * 2
  const slotW = span / text.length
  for (let i = 0; i < text.length; i++) {
    const x = totalPad + slotW * i + randomFloat(2, slotW - 10)
    const y = H / 2 + fontSize / 3
    const rotate = randomInt(-28, 28)
    const dy = randomInt(-6, 6)
    const fs = fontSize + randomInt(-3, 3)
    const r = randomInt(10, 110)
    const g = randomInt(10, 110)
    const b = randomInt(10, 110)
    const font = fonts[randomInt(0, fonts.length - 1)]
    const bold = Math.random() > 0.3 ? 'bold' : 'normal'
    // 部分字符加 letter-spacing 扰动（用 dx 偏移模拟）
    const dx = randomFloat(-2, 2).toFixed(1)
    chars.push(
      `<text x="${x}" y="${y + dy}" dx="${dx}" font-size="${fs}" font-family="${font},sans-serif" font-weight="${bold}" ` +
      `fill="rgb(${r},${g},${b})" transform="rotate(${rotate},${x},${y + dy})" filter="url(#distort)">${text[i]}</text>`
    )
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`,
    filters,
    `<rect width="${W}" height="${H}" fill="rgb(${bgR},${bgG},${bgB})"/>`,
    ...noiseRects,
    ...lines,
    ...chars,
    '</svg>',
  ].join('')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.authSecret as string

  // 生成 5 位验证码
  const text = Array.from({ length: 5 }, randomChar).join('')
  const expires = Date.now() + CAPTCHA_TTL
  const signature = sign(text.toUpperCase(), expires, secret)
  const token = `${text.toUpperCase()}:${expires}:${signature}`

  // 将 token 写入 httpOnly cookie
  setCookie(event, 'captcha_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: CAPTCHA_TTL / 1000,
    path: '/',
  })

  const svg = generateSvgCaptcha(text)

  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'no-store, no-cache')
  return svg
})

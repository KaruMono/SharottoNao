export type RandomSource = () => number

// The same stored color is rendered as text on both white and zinc-800. No
// single luminance can reach WCAG 4.5:1 against both backgrounds, so keep
// random colors near the perceptual midpoint that maximizes the weaker side.
const MIN_RELATIVE_LUMINANCE = 0.215
const MAX_RELATIVE_LUMINANCE = 0.225
const MIN_SATURATION = 58
const SATURATION_STEPS = 21
const LIGHTNESS_SEARCH_STEPS = 24

export function generateRandomTagColor(random: RandomSource = Math.random): string {
  const hue = Math.floor(sample(random) * 360)
  const saturation = (MIN_SATURATION + Math.floor(sample(random) * SATURATION_STEPS)) / 100
  const targetLuminance = MIN_RELATIVE_LUMINANCE
    + sample(random) * (MAX_RELATIVE_LUMINANCE - MIN_RELATIVE_LUMINANCE)
  const lightness = findHslLightness(hue, saturation, targetLuminance)
  const { red, green, blue } = hslToRgb(hue, saturation, lightness)

  return `#${[red, green, blue]
    .map(value => Math.round(value * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function sample(random: RandomSource): number {
  const value = random()
  if (!Number.isFinite(value)) return 0.5
  return Math.min(Math.max(value, 0), 1 - Number.EPSILON)
}

function findHslLightness(hue: number, saturation: number, targetLuminance: number): number {
  let lower = 0
  let upper = 1

  for (let index = 0; index < LIGHTNESS_SEARCH_STEPS; index++) {
    const lightness = (lower + upper) / 2
    const luminance = getRelativeLuminance(hslToRgb(hue, saturation, lightness))
    if (luminance < targetLuminance) lower = lightness
    else upper = lightness
  }

  return (lower + upper) / 2
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const h = hue / 360
  const s = saturation
  const l = lightness

  const hueToRgb = (p: number, q: number, t: number) => {
    let normalized = t
    if (normalized < 0) normalized += 1
    if (normalized > 1) normalized -= 1
    if (normalized < 1 / 6) return p + (q - p) * 6 * normalized
    if (normalized < 1 / 2) return q
    if (normalized < 2 / 3) return p + (q - p) * (2 / 3 - normalized) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    red: hueToRgb(p, q, h + 1 / 3),
    green: hueToRgb(p, q, h),
    blue: hueToRgb(p, q, h - 1 / 3),
  }
}

function getRelativeLuminance(color: { red: number, green: number, blue: number }): number {
  const linearize = (channel: number) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4

  return 0.2126 * linearize(color.red)
    + 0.7152 * linearize(color.green)
    + 0.0722 * linearize(color.blue)
}

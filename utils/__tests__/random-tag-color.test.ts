import { describe, expect, it, vi } from 'vitest'
import { generateRandomTagColor } from '../random-tag-color'

const LIGHT_SURFACE = '#ffffff'
const DARK_SURFACE = '#27272a'

describe('generateRandomTagColor', () => {
  it('converts the lower sampling bounds to a hex color', () => {
    expect(generateRandomTagColor(() => 0)).toBe('#d35858')
  })

  it('uses one random sample for hue, saturation, and target luminance', () => {
    const random = vi.fn()
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)

    expect(generateRandomTagColor(random)).toBe('#1b8f8f')
    expect(random).toHaveBeenCalledTimes(3)
  })

  it('always returns a six-digit lowercase hex color at the upper bounds', () => {
    expect(generateRandomTagColor(() => 0.999999)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps sampled colors readable on both theme surfaces', () => {
    for (let hue = 0; hue < 360; hue++) {
      for (const saturationSample of [0, 0.5, 0.999999]) {
        for (const luminanceSample of [0, 0.5, 0.999999]) {
          const samples = [hue / 360, saturationSample, luminanceSample]
          const color = generateRandomTagColor(() => samples.shift() ?? 0)
          const luminance = relativeLuminance(color)

          expect(luminance).toBeGreaterThanOrEqual(0.21)
          expect(luminance).toBeLessThanOrEqual(0.23)
          expect(contrastRatio(color, LIGHT_SURFACE)).toBeGreaterThanOrEqual(3.7)
          expect(contrastRatio(color, DARK_SURFACE)).toBeGreaterThanOrEqual(3.7)

          // The public tag list applies the accent at 0x15 alpha behind its text.
          expect(contrastAgainstTintedSurface(color, LIGHT_SURFACE, 0x15 / 255)).toBeGreaterThanOrEqual(3.3)
          expect(contrastAgainstTintedSurface(color, DARK_SURFACE, 0x15 / 255)).toBeGreaterThanOrEqual(3.3)
        }
      }
    }
  })

  it('still distributes colors across the hue wheel', () => {
    const colors = Array.from({ length: 24 }, (_, index) => {
      const samples = [index / 24, 0.5, 0.5]
      return generateRandomTagColor(() => samples.shift() ?? 0)
    })

    expect(new Set(colors).size).toBe(colors.length)
  })
})

function contrastAgainstTintedSurface(color: string, surface: string, alpha: number): number {
  const foreground = parseHexColor(color)
  const background = parseHexColor(surface)
  const tinted = foreground.map((channel, index) => (
    channel * alpha + (background[index] ?? 0) * (1 - alpha)
  ))
  return contrastFromLuminance(relativeLuminance(color), relativeLuminanceFromRgb(tinted))
}

function contrastRatio(first: string, second: string): number {
  return contrastFromLuminance(relativeLuminance(first), relativeLuminance(second))
}

function contrastFromLuminance(first: number, second: number): number {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function relativeLuminance(color: string): number {
  return relativeLuminanceFromRgb(parseHexColor(color))
}

function relativeLuminanceFromRgb(color: number[]): number {
  const [red = 0, green = 0, blue = 0] = color.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function parseHexColor(color: string): number[] {
  return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16))
}

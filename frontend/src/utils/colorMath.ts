import { colord, extend } from 'colord'
import a11yPlugin from 'colord/plugins/a11y'

extend([a11yPlugin])

export type HslTuple = [number, number, number]

const FALLBACK_HEX = '#2563eb'

export const hexToHslTuple = (hex: string): HslTuple => {
  const instance = colord(hex)
  const safe = instance.isValid() ? instance : colord(FALLBACK_HEX)
  const { h, s, l } = safe.toHsl()
  return [h || 0, s, l]
}

export const formatHslVar = ([h, s, l]: HslTuple): string =>
  `${h} ${s}% ${l}%`

export const getRelativeLuminance = (hex: string): number => {
  const instance = colord(hex)
  const safe = instance.isValid() ? instance : colord(FALLBACK_HEX)
  return safe.luminance()
}

export const getAccessibleTextColor = (
  hex: string,
): '#000000' | '#FFFFFF' => {
  const base = colord(hex)
  const safe = base.isValid() ? base : colord(FALLBACK_HEX)

  const contrastOnWhite = safe.contrast('#ffffff')
  const contrastOnBlack = safe.contrast('#000000')

  return contrastOnBlack >= contrastOnWhite ? '#000000' : '#FFFFFF'
}

export const deriveThemeFromHex = (primaryHex: string) => {
  const primaryHsl = hexToHslTuple(primaryHex)
  const primary = formatHslVar(primaryHsl)

  const foregroundHex = getAccessibleTextColor(primaryHex)
  const foregroundHsl = hexToHslTuple(foregroundHex)
  const primaryForeground = formatHslVar(foregroundHsl)

  return {
    primary,
    primaryForeground,
  }
}


/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the conversation content font size. */
export const FONT_SIZE_FIELD = 'fontSize'

/** Field carrying the custom background mode. */
export const BACKGROUND_MODE_FIELD = 'backgroundMode'

/** Field carrying the custom background color (color mode). */
export const BACKGROUND_COLOR_FIELD = 'backgroundColor'

/** Field carrying the custom background image URL (image mode). */
export const BACKGROUND_URL_FIELD = 'backgroundUrl'

/** Field carrying the base-surface opacity over the background image, in percent. */
export const BACKGROUND_DIM_FIELD = 'backgroundDim'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Smallest accepted content font size (px). */
export const FONT_SIZE_MIN = 12

/** Largest accepted content font size (px). */
export const FONT_SIZE_MAX = 17

/** Content font size when the user-settings document has no override (px). */
export const DEFAULT_FONT_SIZE = 14

/** Background modes: the themed default, a solid user color, or a user image. */
export const BACKGROUND_MODES = ['default', 'color', 'image'] as const

/** Background mode persisted by the product Background row. */
export type BackgroundMode = typeof BACKGROUND_MODES[number]

/** Default background mode when the user-settings document has no override. */
export const DEFAULT_BACKGROUND_MODE: BackgroundMode = 'default'

/** Initial color-picker value for the color mode. */
export const DEFAULT_BACKGROUND_COLOR = '#4d6bfe'

/** Initial URL for the image mode. */
export const DEFAULT_BACKGROUND_URL = ''

/** Base-surface opacity over the background image, in percent (0 = fully transparent). */
export const DEFAULT_BACKGROUND_DIM = 60

/** Largest accepted base-surface opacity over the background image. */
export const BACKGROUND_DIM_MAX = 90

/** Durable custom-background configuration shared by the Host boot paint and the browser. */
export interface BackgroundSettings {
  /** Which background treatment the page uses. */
  mode: BackgroundMode
  /** Solid background color (color mode). */
  color: string
  /** Background image URL (image mode). */
  url: string
  /** Base-surface opacity over the image, in percent (integer within 0..{@link BACKGROUND_DIM_MAX}). */
  dim: number
}

/**
 * The background configuration as a theme snapshot projects it: the durable
 * fields plus the `--dsw-alias-bg-base` override the theme runtime computed
 * for the active palette (color mode: the user color; image mode: the dimmed
 * translucent wash; default or an unpaintable configuration: undefined).
 * Presenters project this value; callers never set it.
 */
export interface BackgroundProjection extends BackgroundSettings {
  /** The palette-aware base-surface override, or undefined when none applies. */
  baseOverride: string | undefined
}

/** Default background configuration: the themed plain surface. */
export const DEFAULT_BACKGROUND: BackgroundSettings = {
  mode: DEFAULT_BACKGROUND_MODE,
  color: DEFAULT_BACKGROUND_COLOR,
  url: DEFAULT_BACKGROUND_URL,
  dim: DEFAULT_BACKGROUND_DIM,
}

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Conversation content font size in px (integer within {@link FONT_SIZE_MIN}..{@link FONT_SIZE_MAX}). */
  fontSize: number
  /** Which custom background treatment the page uses. */
  backgroundMode: BackgroundMode
  /** Solid background color (color mode). */
  backgroundColor: string
  /** Background image URL (image mode). */
  backgroundUrl: string
  /** Base-surface opacity over the background image, in percent. */
  backgroundDim: number
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [FONT_SIZE_FIELD]: z.number().step(1).min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).default(DEFAULT_FONT_SIZE),
  [BACKGROUND_MODE_FIELD]: z.union([...BACKGROUND_MODES]).default(DEFAULT_BACKGROUND_MODE),
  [BACKGROUND_COLOR_FIELD]: z.string().default(DEFAULT_BACKGROUND_COLOR),
  [BACKGROUND_URL_FIELD]: z.string().default(DEFAULT_BACKGROUND_URL),
  [BACKGROUND_DIM_FIELD]: z.number().step(1).min(0).max(BACKGROUND_DIM_MAX).default(DEFAULT_BACKGROUND_DIM),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/**
 * Narrow one wire or registry value to a persistable background mode.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in background mode.
 */
export function isBackgroundMode(value: unknown): value is BackgroundMode {
  return BACKGROUND_MODES.some(mode => mode === value)
}

/** Light base-surface color the translucent override washes over an image. */
const LIGHT_BASE = 'rgb(255, 255, 255)'

/** Dark base-surface color the translucent override washes over an image. */
const DARK_BASE = 'rgb(21, 21, 23)'

/**
 * The `--dsw-alias-bg-base` override a custom background needs, per palette:
 * the user color in color mode, a dimmed translucent wash of the active base
 * in image mode, and undefined for the default (the base stylesheets keep
 * authority) or for an unpaintable configuration (an image mode without a
 * URL). Folding paintability here keeps every presenter a pure projector.
 * @param background - the durable background configuration.
 * @param dark - whether the dark base palette is active.
 * @returns the override value, or undefined when none applies.
 */
export function backgroundBaseOverride(background: BackgroundSettings, dark: boolean): string | undefined {
  if (!isBackgroundPaintable(background)) return undefined
  if (background.mode === 'color') return background.color
  if (background.mode === 'image') {
    const base = dark ? DARK_BASE : LIGHT_BASE
    return `color-mix(in srgb, ${base} ${String(background.dim)}%, transparent)`
  }
  return undefined
}

/**
 * Whether one durable background configuration is usable for its mode: the
 * color mode needs a color, the image mode needs a URL.
 * @param background - the configuration to check.
 * @returns whether the page can paint it.
 */
export function isBackgroundPaintable(background: BackgroundSettings): boolean {
  if (background.mode === 'color') return background.color !== ''
  if (background.mode === 'image') return background.url !== ''
  return true
}

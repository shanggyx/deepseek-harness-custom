/**
 * Theme bootstrap row for the browser's pre-plugin interval. Each index
 * render embeds the current durable theme section — built-in preference,
 * content font size, and the custom background —; the browser resolves only
 * `system`, paints the background before first paint, and writes the same
 * DOM fields ui-layout's ThemePresenter owns after the client plugin tree
 * activates.
 */

import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import {
  DEFAULT_BACKGROUND, DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE, backgroundBaseOverride,
  isBackgroundPaintable, type BackgroundSettings, type ThemePreference,
} from './theme-settings.ts'

/** Build the inline script body for one schema-validated durable theme section. */
function bootThemeScript(preference: ThemePreference, fontSize: number, background: BackgroundSettings): string {
  const paintable = isBackgroundPaintable(background)
  // The bg-base override is scheme-aware (the image wash mixes over the
  // active palette's base), so both variants are precomputed here and the
  // script picks one after resolving `system`.
  const overrideLight = paintable ? backgroundBaseOverride(background, false) : undefined
  const overrideDark = paintable ? backgroundBaseOverride(background, true) : undefined
  return `(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  document.body.style.setProperty('--dsh-content-font-size', ${JSON.stringify(`${fontSize}px`)})
  document.body.dataset.dshBackgroundMode = ${JSON.stringify(background.mode)}
  document.body.dataset.dshBackgroundColor = ${JSON.stringify(background.color)}
  document.body.dataset.dshBackgroundUrl = ${JSON.stringify(background.url)}
  document.body.dataset.dshBackgroundDim = ${JSON.stringify(String(background.dim))}
  const baseOverride = dark ? ${JSON.stringify(overrideDark ?? null)} : ${JSON.stringify(overrideLight ?? null)}
  if (baseOverride !== null) {
    document.body.style.setProperty('--dsw-alias-bg-base', baseOverride)
  }
  const background = ${JSON.stringify(paintable ? background : null)}
  if (background !== null) {
    if (background.mode === 'color') {
      document.body.style.backgroundColor = background.color
    }
    if (background.mode === 'image') {
      document.body.style.backgroundImage = 'url("' + background.url.replace(/"/g, '%22') + '")'
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      document.body.style.backgroundAttachment = 'fixed'
    }
  }
})()`
}

/**
 * The theme bootstrap as an injection row: an inline script immediately after
 * the opening body tag, before the shell mount and module script.
 * @param preference - Current Host-backed built-in preference.
 * @param fontSize - Current Host-backed content font size in px.
 * @param background - Current Host-backed custom background configuration.
 * @returns the body script row.
 */
export function bootThemeInjection(
  preference: ThemePreference = DEFAULT_PREFERENCE,
  fontSize: number = DEFAULT_FONT_SIZE,
  background: BackgroundSettings = DEFAULT_BACKGROUND,
): IndexInjection {
  return { kind: 'script', placement: 'body', text: bootThemeScript(preference, fontSize, background) }
}

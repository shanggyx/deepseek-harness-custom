/**
 * Global theme DOM applier: projects the resolved ThemeSnapshot onto the
 * document — `html { color-scheme }` for native UA chrome (scrollbars, form
 * controls), `body[data-ds-dark-theme]` for the token palette, the active
 * theme's alias-token overrides as inline CSS variables on body, the content
 * font-size axis (`--dsh-content-font-size`), and one presenter-owned
 * `meta[name="theme-color"]` for surrounding browser UI. Pure DOM writes, no
 * React involvement; the presenter only ever retracts what it wrote itself,
 * so foreign attributes, metadata, and inline styles survive.
 */
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Body attribute selecting the dark base palette in the token stylesheets. */
export const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/** Body variable carrying the user's content font size in px. */
export const CONTENT_FONT_SIZE_VARIABLE = '--dsh-content-font-size'

/** Body inline styles this presenter writes for the custom background. */
const BACKGROUND_PROPERTIES = [
  '--dsw-alias-bg-base', 'background-color', 'background-image', 'background-size', 'background-position',
  'background-attachment',
] as const

/** Applies theme snapshots to the document; one instance per plugin fiber. */
export class ThemePresenter {
  /** Token names this presenter wrote in the last apply (its retraction set). */
  private appliedTokens: string[] = []
  /** The single metadata node this presenter inserts and removes. */
  private readonly themeColorMeta: HTMLMetaElement

  /** Create the presenter-owned metadata node before the first snapshot arrives. */
  constructor() {
    this.themeColorMeta = document.createElement('meta')
    this.themeColorMeta.name = 'theme-color'
  }

  /**
   * Project a snapshot onto the document: set root `color-scheme` and the body
   * palette attribute from `active.colorScheme` (never the id — `system` is
   * resolved upstream), publish the content font-size axis, then replace the
   * previously applied token variables with `active.tokens`. Browser
   * theme-color metadata follows the computed body background after those
   * writes, so the rendered palette remains the color authority.
   * @param snapshot - resolved theme snapshot from ctx.theme.
   */
  apply(snapshot: ThemeSnapshot): void {
    const scheme = snapshot.active.colorScheme
    document.documentElement.style.colorScheme = scheme
    const body = document.body
    if (scheme === 'dark') body.setAttribute(DARK_ATTRIBUTE, '')
    else body.removeAttribute(DARK_ATTRIBUTE)
    body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    this.appliedTokens = []
    for (const [name, value] of Object.entries(snapshot.active.tokens)) {
      body.style.setProperty(name, value)
      this.appliedTokens.push(name)
    }
    this.applyBackground(body, snapshot)
    this.themeColorMeta.content = getComputedStyle(body).backgroundColor
    if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta)
  }

  /**
   * Project the custom background: the runtime-precomputed bg-base override
   * (user color, or the dimmed translucent wash an image shows through) plus
   * the paint properties for image mode. `undefined` retracts everything this
   * presenter wrote, restoring the base stylesheets' authority.
   */
  private applyBackground(body: HTMLElement, snapshot: ThemeSnapshot): void {
    const { mode, color, url, baseOverride } = snapshot.background
    for (const name of BACKGROUND_PROPERTIES) body.style.removeProperty(name)
    if (baseOverride === undefined) return
    body.style.setProperty('--dsw-alias-bg-base', baseOverride)
    if (mode === 'color') {
      body.style.backgroundColor = color
      return
    }
    if (mode === 'image' && url !== '') {
      body.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`
      body.style.backgroundSize = 'cover'
      body.style.backgroundPosition = 'center'
      body.style.backgroundAttachment = 'fixed'
    }
  }

  /** Retract root color-scheme, the palette attribute, token variables, the font-size axis, the background, and the owned metadata node. */
  dispose(): void {
    document.documentElement.style.removeProperty('color-scheme')
    const body = document.body
    body.removeAttribute(DARK_ATTRIBUTE)
    body.style.removeProperty(CONTENT_FONT_SIZE_VARIABLE)
    for (const name of this.appliedTokens) body.style.removeProperty(name)
    for (const name of BACKGROUND_PROPERTIES) body.style.removeProperty(name)
    this.appliedTokens = []
    this.themeColorMeta.remove()
  }
}

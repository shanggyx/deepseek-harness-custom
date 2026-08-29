// @vitest-environment jsdom
/** The theme bootstrap injection row and the resulting pre-plugin browser theme. */
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootThemeInjection } from '../src/boot-theme.ts'
import type { ThemePreference } from '../src/theme-settings.ts'

const DARK_ATTRIBUTE = 'data-ds-dark-theme'

function mockSystemDark(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches }) as MediaQueryList))
}

function executeBootstrap(preference?: ThemePreference, fontSize?: number): void {
  const row = bootThemeInjection(preference, fontSize)
  if (row.kind !== 'script') throw new Error('theme bootstrap row is not a script')
  runInNewContext(row.text, { document, matchMedia: globalThis.matchMedia })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('color-scheme')
  document.body.removeAttribute(DARK_ATTRIBUTE)
  document.body.style.removeProperty('--dsh-content-font-size')
  // The background paint rides the same shared jsdom body; clear it so a
  // later default-mode case observes a clean start.
  for (const property of [
    '--dsw-alias-bg-base', 'background-color', 'background-image', 'background-size', 'background-position',
    'background-attachment',
  ]) document.body.style.removeProperty(property)
  delete document.body.dataset.dshBackgroundMode
  delete document.body.dataset.dshBackgroundColor
  delete document.body.dataset.dshBackgroundUrl
  delete document.body.dataset.dshBackgroundDim
})

describe('theme bootstrap background', () => {
  function executeWithBackground(background: Parameters<typeof bootThemeInjection>[2], preference: ThemePreference = 'dark'): void {
    const row = bootThemeInjection(preference, 14, background)
    if (row.kind !== 'script') throw new Error('theme bootstrap row is not a script')
    mockSystemDark(false)
    runInNewContext(row.text, { document, matchMedia: globalThis.matchMedia })
  }

  it('paints the solid color and the bg-base override in color mode', () => {
    executeWithBackground({ mode: 'color', color: '#112233', url: '', dim: 60 })
    expect(document.body.style.backgroundColor).toBe('rgb(17, 34, 51)')
    expect(document.body.style.getPropertyValue('--dsw-alias-bg-base')).toBe('#112233')
    expect(document.body.dataset.dshBackgroundMode).toBe('color')
  })

  it('paints the image and the dimmed translucent base override in image mode', () => {
    executeWithBackground({ mode: 'image', color: '', url: 'https://example.com/w.png', dim: 45 })
    expect(document.body.style.backgroundImage).toBe('url("https://example.com/w.png")')
    expect(document.body.style.backgroundSize).toBe('cover')
    expect(document.body.style.backgroundAttachment).toBe('fixed')
    expect(document.body.style.getPropertyValue('--dsw-alias-bg-base'))
      .toBe('color-mix(in srgb, rgb(21, 21, 23) 45%, transparent)')
  })

  it('paints no background in the default mode and leaves the dataset for the runtime', () => {
    executeWithBackground({ mode: 'default', color: '', url: '', dim: 60 })
    expect(document.body.style.backgroundImage).toBe('')
    expect(document.body.style.getPropertyValue('--dsw-alias-bg-base')).toBe('')
    expect(document.body.dataset.dshBackgroundMode).toBe('default')
  })

  it('light palettes mix the light base for a system-resolved boot', () => {
    executeWithBackground({ mode: 'image', color: '', url: 'https://example.com/w.png', dim: 45 }, 'system')
    expect(document.body.style.getPropertyValue('--dsw-alias-bg-base'))
      .toBe('color-mix(in srgb, rgb(255, 255, 255) 45%, transparent)')
  })
})

describe('theme bootstrap row', () => {
  it('is a body script row, so it runs before the shell mount', () => {
    mockSystemDark(false)
    const row = bootThemeInjection('dark')
    expect(row).toMatchObject({ kind: 'script', placement: 'body' })
    executeBootstrap('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(true)
  })

  it('lets durable light override a dark OS and clears stale dark state', () => {
    document.body.setAttribute(DARK_ATTRIBUTE, '')
    mockSystemDark(true)
    executeBootstrap('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
  })

  it.each([
    [true, 'dark', true],
    [false, 'light', false],
  ] as const)('resolves system=%s to %s', (matches, colorScheme, dark) => {
    mockSystemDark(matches)
    executeBootstrap('system')
    expect(document.documentElement.style.colorScheme).toBe(colorScheme)
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(dark)
  })

  it('defaults to system and falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    executeBootstrap()
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
  })

  it('writes the durable content font size and defaults it to 14px', () => {
    mockSystemDark(false)
    executeBootstrap('light', 17)
    expect(document.body.style.getPropertyValue('--dsh-content-font-size')).toBe('17px')
    executeBootstrap('light')
    expect(document.body.style.getPropertyValue('--dsh-content-font-size')).toBe('14px')
  })
})

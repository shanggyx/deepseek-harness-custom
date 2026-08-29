/**
 * Background preference row registered into the General section item slot:
 * title + three mode cubes (default / solid color / image) with the mode's
 * payload control beneath — a color picker for 纯色, a URL field plus a
 * surface-opacity slider for 图片. Registered by this package — the theme
 * feature owns its own settings surface. Displayed values follow the
 * persisted setting, never the click echo; the URL field drafts locally and
 * commits on blur/Enter (a half-typed URL is not a committable value).
 */
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { BACKGROUND_DIM_MAX, DEFAULT_BACKGROUND_COLOR, type BackgroundMode, type BackgroundSettings } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createBackgroundRowStore } from './settings-store.ts'
import appearanceCss from './AppearanceRow.module.css'
import css from './BackgroundRow.module.css'

declare global {
  interface Window {
    /** The desktop shell preload bridge; absent in plain browsers. */
    dshShell?: {
      /** Store an imported image and resolve to its app-protocol URL. */
      setBackgroundImage: (bytes: ArrayBuffer) => Promise<string>
    }
  }
}

/** Injected business face: the background write (t rides the standard locale seat). */
export interface BackgroundRowInjected {
  /** Replace the durable background configuration. */
  setBackground: (background: BackgroundSettings) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type BackgroundRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createBackgroundRowStore>>
  & PropsLocale<'settings.theme'> & BackgroundRowInjected

/** Cube order and labels (default themed surface, solid color, image). */
const CUBES: readonly { id: BackgroundMode; labelKey: ThemeKey }[] = [
  { id: 'default', labelKey: 'background.default' },
  { id: 'color', labelKey: 'background.color' },
  { id: 'image', labelKey: 'background.image' },
]

/**
 * Render the Background row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function BackgroundRow({ t, setBackground, useStore }: BackgroundRowComponentProps) {
  const { mode, color, url, dim } = useStore(s => s)
  const [urlDraft, setUrlDraft] = useState(url)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  useEffect(() => { setUrlDraft(url) }, [url])

  const setMode = (next: BackgroundMode): void => {
    setBackground({
      mode: next,
      color: color === '' ? DEFAULT_BACKGROUND_COLOR : color,
      url: urlDraft,
      dim,
    })
  }
  const commitUrl = (): void => {
    if (urlDraft === url) return
    if (urlDraft === '') {
      setUrlDraft(url)
      return
    }
    setBackground({ mode: 'image', color, url: urlDraft, dim })
  }
  const importLocal = async (file: File): Promise<void> => {
    setImporting(true)
    try {
      const bridge = window.dshShell
      if (bridge === undefined) return
      const importedUrl = await bridge.setBackgroundImage(await file.arrayBuffer())
      setUrlDraft(importedUrl)
      setBackground({ mode: 'image', color, url: importedUrl, dim })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('background.title')}</div>
        <div className={css.desc}>{t('background.description')}</div>
      </div>
      <div className={css.control}>
        <div className={appearanceCss.cubeRow}>
          {CUBES.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              className={clsx(appearanceCss.themeCube, mode === id && appearanceCss.selected)}
              aria-pressed={mode === id}
              onClick={() => { setMode(id) }}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        {mode === 'color' && (
          <input
            type="color"
            className={css.colorInput}
            aria-label={t('background.color')}
            value={color === '' ? DEFAULT_BACKGROUND_COLOR : color}
            onChange={(event) => { setBackground({ mode: 'color', color: event.target.value, url: urlDraft, dim }) }}
          />
        )}
        {mode === 'image' && (
          <div className={css.imageControls}>
            <input
              type="text"
              className={css.urlInput}
              value={urlDraft}
              placeholder={t('background.urlPlaceholder')}
              title={urlDraft === '' ? t('background.urlRequired') : undefined}
              onChange={(event) => { setUrlDraft(event.target.value) }}
              onBlur={commitUrl}
              onKeyDown={(event) => { if (event.key === 'Enter') commitUrl() }}
            />
            {window.dshShell !== undefined && (
              <>
                <button
                  type="button"
                  className={css.localButton}
                  disabled={importing}
                  onClick={() => { fileInput.current?.click() }}
                >
                  {importing ? t('background.importing') : t('background.local')}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className={css.fileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file !== undefined) void importLocal(file)
                  }}
                />
              </>
            )}
            <label className={css.dimControl}>
              <span className={css.dimLabel}>{t('background.dim')}</span>
              <input
                type="range"
                min={0}
                max={BACKGROUND_DIM_MAX}
                step={5}
                value={dim}
                disabled={urlDraft === ''}
                aria-label={t('background.dim')}
                onChange={(event) => {
                  const nextDim = Number.parseInt(event.target.value, 10)
                  if (urlDraft === '') return
                  setBackground({ mode: 'image', color, url: urlDraft, dim: nextDim })
                }}
              />
              <span className={css.dimValue}>{dim}%</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

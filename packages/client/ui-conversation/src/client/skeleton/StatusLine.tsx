/**
 * Composer status line: one slim row under the composer's control row fed by
 * the token-meter projections — context occupancy and the durable-log cache
 * hit share. Renders nothing until either figure is known, so sessions
 * without a reporting provider stay visually unchanged. The token 宠物 seat
 * lands beside these figures in a later iteration.
 */

import type { UseProjection } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: the `contextPressure` / `tokenUsage` projection key merges.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { ComposerBarProps } from '../contract/slots.ts'
import { contextOccupancy } from '../context-occupancy.ts'
import css from './StatusLine.module.css'

/** Props: the bar's projection hook and locale seat, passed down as plain props. */
export interface StatusLineProps {
  useProjection: UseProjection
  /** The owning bar's locale seat, passed down as a plain prop. */
  t: ComposerBarProps['t']
}

/**
 * Cache-hit share of prompt-side input over the whole durable log, in whole
 * percent; null until a usage projection reports a non-empty denominator.
 * @param usage - latest token usage projection.
 * @returns the hit percent, or null when nothing was measured yet.
 */
export function cacheHitPercentValue(usage: TokenUsageProjection | undefined): number | null {
  if (usage === undefined) return null
  const denominator = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  if (denominator === 0) return null
  return Math.round(usage.cacheReadTokens / denominator * 100)
}

/**
 * Render the composer status line.
 * @param props - the bar's projection hook and locale seat.
 * @returns the status line, or null while nothing is measurable.
 */
export function StatusLine({ useProjection, t }: StatusLineProps) {
  const occupancy = contextOccupancy(useProjection('contextPressure'))
  const hit = cacheHitPercentValue(useProjection('tokenUsage'))
  if (occupancy === null && hit === null) return null
  return (
    <div className={css.statusLine} data-dsh-status-line>
      {occupancy !== null && (
        <span className={css.item}>{t('status.context', { percent: occupancy.percent })}</span>
      )}
      {hit !== null && (
        <span className={css.item}>{t('status.cacheHit', { percent: hit })}</span>
      )}
    </div>
  )
}

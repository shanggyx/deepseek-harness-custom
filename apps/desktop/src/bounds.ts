/**
 * Persisted BrowserWindow geometry. The desktop shell remembers the window's
 * last size and position across runs; the sanitizer is pure so the saved
 * shape is validated against the current display without Electron.
 * @module @deepseek-ai/dsh-desktop/bounds
 */

/** The window geometry persisted between runs. */
export interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

/** The smallest window the three-column UI layout stays usable at. */
export const MIN_WIDTH = 720
export const MIN_HEIGHT = 480

/** First-run window size: wider than the sidebar auto-collapse breakpoint so the shell opens three-column. */
export const DEFAULT_WIDTH = 1440
export const DEFAULT_HEIGHT = 900

/** The display rectangle a saved position must intersect to be reused. */
export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Validate and clamp a parsed window-bounds document against the current
 * work area. A saved size that shrank below the minimum (or a display change)
 * snaps back to the minimum; a position that lost its display (monitor
 * unplugged, resolution change) is dropped so the OS cascades the window.
 * @param value - the parsed JSON document, untrusted.
 * @param workArea - the usable rectangle of the display the window opens on.
 * @returns the bounds to open with, or undefined when nothing usable remains.
 */
export function sanitizeBounds(value: unknown, workArea: WorkArea): WindowBounds | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const width = clampSize(record['width'], workArea.width, MIN_WIDTH)
  const height = clampSize(record['height'], workArea.height, MIN_HEIGHT)
  if (width === undefined || height === undefined) return undefined
  const x = clampPosition(record['x'], workArea.x, workArea.x + workArea.width - width)
  const y = clampPosition(record['y'], workArea.y, workArea.y + workArea.height - height)
  return {
    width,
    height,
    ...x !== undefined && { x },
    ...y !== undefined && { y },
  }
}

/** A usable size is a whole number clamped into [min, workArea]. */
function clampSize(value: unknown, areaSize: number, min: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) return undefined
  return Math.min(value, areaSize)
}

/**
 * A usable position keeps the title bar reachable: it pins the window inside
 * the work area. undefined (centered) survives — an absent position is a
 * choice, not corruption.
 */
function clampPosition(value: unknown, areaMin: number, areaMax: number): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined
  return Math.min(Math.max(value, areaMin), areaMax)
}

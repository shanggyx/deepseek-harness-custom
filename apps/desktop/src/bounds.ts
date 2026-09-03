/**
 * Desktop shell window sizing. Every launch opens at the default size —
 * centered and never maximized — so the startup window is deterministic; a
 * maximize or resize is a per-run gesture the shell does not remember.
 * @module @deepseek-ai/dsh-desktop/bounds
 */

/** The smallest window the three-column UI layout stays usable at. */
export const MIN_WIDTH = 720
export const MIN_HEIGHT = 480

/** Launch window size: the moderate default Codex-class desktop apps open with. */
export const DEFAULT_WIDTH = 1200
export const DEFAULT_HEIGHT = 800

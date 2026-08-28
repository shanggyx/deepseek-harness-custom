import { describe, expect, it } from 'vitest'
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_HEIGHT, MIN_WIDTH, sanitizeBounds } from '../src/bounds.ts'

/** A roomy display the saved geometry is validated against. */
const WORK_AREA = { x: 0, y: 0, width: 2560, height: 1400 }

describe('sanitizeBounds', () => {
  it('keeps a well-formed saved document', () => {
    expect(sanitizeBounds({ width: 1200, height: 800, x: 10, y: 20 }, WORK_AREA))
      .toEqual({ width: 1200, height: 800, x: 10, y: 20 })
  })

  it('keeps a saved document without a position (centered is a choice)', () => {
    expect(sanitizeBounds({ width: 1200, height: 800 }, WORK_AREA))
      .toEqual({ width: 1200, height: 800 })
  })

  it('rejects non-object documents', () => {
    expect(sanitizeBounds(undefined, WORK_AREA)).toBeUndefined()
    expect(sanitizeBounds(null, WORK_AREA)).toBeUndefined()
    expect(sanitizeBounds('big', WORK_AREA)).toBeUndefined()
  })

  it('rejects sizes below the minimum instead of silently opening unusable', () => {
    expect(sanitizeBounds({ width: MIN_WIDTH - 1, height: 800 }, WORK_AREA)).toBeUndefined()
    expect(sanitizeBounds({ width: 1200, height: MIN_HEIGHT - 1 }, WORK_AREA)).toBeUndefined()
  })

  it('rejects non-integer and non-numeric sizes', () => {
    expect(sanitizeBounds({ width: 1200.5, height: 800 }, WORK_AREA)).toBeUndefined()
    expect(sanitizeBounds({ width: '1200', height: 800 }, WORK_AREA)).toBeUndefined()
  })

  it('clamps a size larger than the current display', () => {
    expect(sanitizeBounds({ width: 4000, height: 2000 }, WORK_AREA))
      .toEqual({ width: 2560, height: 1400 })
  })

  it('clamps a position left on a since-disconnected display into the work area', () => {
    const leftDisplay = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(sanitizeBounds({ width: 1200, height: 800, x: 2200, y: -400 }, leftDisplay))
      .toEqual({ width: 1200, height: 800, x: 720, y: 0 })
  })

  it('rejects a non-integer position but keeps the size', () => {
    expect(sanitizeBounds({ width: 1200, height: 800, x: 10.5 }, WORK_AREA))
      .toEqual({ width: 1200, height: 800 })
  })

  it('exposes defaults the first run opens with', () => {
    // The defaults must clear the sidebar auto-collapse breakpoint with room
    // for the three-column solver; assert the contract the shell relies on.
    expect(DEFAULT_WIDTH).toBeGreaterThan(MIN_WIDTH)
    expect(DEFAULT_HEIGHT).toBeGreaterThan(MIN_HEIGHT)
  })
})

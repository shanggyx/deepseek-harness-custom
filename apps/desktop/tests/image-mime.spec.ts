import { describe, expect, it } from 'vitest'
import { detectImageMime } from '../src/image-mime.ts'

describe('detectImageMime', () => {
  it('sniffs PNG magic bytes', () => {
    expect(detectImageMime(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
  })

  it('sniffs JPEG magic bytes', () => {
    expect(detectImageMime(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  it('sniffs GIF87a and GIF89a', () => {
    expect(detectImageMime(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe('image/gif')
    expect(detectImageMime(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif')
  })

  it('sniffs WebP (RIFF container)', () => {
    expect(detectImageMime(Uint8Array.of(
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00,
    ))).toBe('image/webp')
  })

  it('falls back to the generic stream type for unknown bytes', () => {
    expect(detectImageMime(Uint8Array.of(0x00, 0x01, 0x02))).toBe('application/octet-stream')
  })
})

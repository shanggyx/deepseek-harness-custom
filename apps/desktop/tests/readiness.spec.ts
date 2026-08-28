import { describe, expect, it } from 'vitest'
import { parseReadyUrl } from '../src/readiness.ts'

describe('parseReadyUrl', () => {
  it('parses the readiness line the web runtime prints', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:3080')).toEqual(new URL('http://127.0.0.1:3080'))
  })

  it('parses an OS-assigned port', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:54321')).toEqual(new URL('http://127.0.0.1:54321'))
  })

  it('takes the URL token and drops the LAN suffix', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:3080 (LAN: http://192.168.1.10:3080)'))
      .toEqual(new URL('http://127.0.0.1:3080'))
  })

  it('finds the prefix inside log-decorated lines', () => {
    expect(parseReadyUrl('[2026-08-28] dsh web: http://127.0.0.1:3080')).toEqual(new URL('http://127.0.0.1:3080'))
  })

  it('accepts other lines through untouched', () => {
    expect(parseReadyUrl('dsh: booting profile web')).toBeUndefined()
    expect(parseReadyUrl('')).toBeUndefined()
  })

  it('rejects a prefix whose token is not a URL', () => {
    expect(parseReadyUrl('dsh web: not-a-url')).toBeUndefined()
  })

  it('rejects a prefix whose token is a non-http protocol', () => {
    expect(parseReadyUrl('dsh web: file:///etc/passwd')).toBeUndefined()
    expect(parseReadyUrl('dsh web: javascript:alert(1)')).toBeUndefined()
  })
})

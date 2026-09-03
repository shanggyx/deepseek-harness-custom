/** The remote-workspace anchor seam: path safety, ownership, and the clause. */

import { rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  anchorPathOf, defaultAnchorRoot, ensureAnchor, hostForAnchor, isAnchorSegment,
  renderSshWorkspaceContext,
} from '../src/workspace.ts'
import type { SshHostConfig } from '../src/config.ts'

/** Scratch anchor root; the suite never touches unrelated temp contents. */
const scratch = join(tmpdir(), 'dsh-remote-workspaces-test')
beforeAll(async () => { await rm(scratch, { recursive: true, force: true }) })
afterAll(async () => { await rm(scratch, { recursive: true, force: true }) })

const host: SshHostConfig = {
  name: 'seetacloud', host: 'connect.seetacloud.com', port: 26704, username: 'root',
}

describe('isAnchorSegment', () => {
  it('accepts ordinary names and refuses path-traversal shapes', () => {
    expect(isAnchorSegment('autodl-rl')).toBe(true)
    expect(isAnchorSegment('')).toBe(false)
    expect(isAnchorSegment('.')).toBe(false)
    expect(isAnchorSegment('..')).toBe(false)
    expect(isAnchorSegment('a/b')).toBe(false)
    expect(isAnchorSegment('a' + sep + 'b')).toBe(false)
  })
})

describe('anchorPathOf', () => {
  it('defaults to the OS temp directory, outside the user profile', () => {
    expect(anchorPathOf('seetacloud')).toBe(join(defaultAnchorRoot(), 'seetacloud'))
    expect(defaultAnchorRoot().startsWith(tmpdir())).toBe(true)
  })

  it('honors a configured root', () => {
    expect(anchorPathOf('seetacloud', scratch)).toBe(join(scratch, 'seetacloud'))
  })

  it('refuses names that would escape the anchor root', () => {
    expect(() => anchorPathOf('../escape')).toThrow('cannot anchor a remote workspace')
  })
})

describe('ensureAnchor', () => {
  it('creates the directory for later stat-backed workspace adoption', async () => {
    const anchor = await ensureAnchor('lab', scratch)
    expect((await stat(anchor)).isDirectory()).toBe(true)
  })
})

describe('hostForAnchor', () => {
  it('maps a cwd under one host anchor back to that host', () => {
    const anchor = anchorPathOf('seetacloud', scratch)
    expect(hostForAnchor(join(anchor, 'sub', 'dir'), [host], scratch)).toEqual(host)
    expect(hostForAnchor(anchor, [host], scratch)).toEqual(host)
  })

  it('ignores sibling directories, other hosts, and disabled hosts', () => {
    const sibling = anchorPathOf('seetacloud', scratch) + '-other'
    expect(hostForAnchor(sibling, [host], scratch)).toBeUndefined()
    expect(hostForAnchor(anchorPathOf('other', scratch), [host], scratch)).toBeUndefined()
    expect(hostForAnchor(anchorPathOf('seetacloud', scratch), [{ ...host, enabled: false }], scratch)).toBeUndefined()
  })
})

describe('renderSshWorkspaceContext', () => {
  it('names the host, its endpoint, and the backend type the agent must open', () => {
    const text = renderSshWorkspaceContext(host)
    expect(text).toContain('remote host seetacloud')
    expect(text).toContain('root@connect.seetacloud.com:26704')
    expect(text).toContain('type "ssh:seetacloud"')
    expect(text).toContain('terminal_open')
  })
})

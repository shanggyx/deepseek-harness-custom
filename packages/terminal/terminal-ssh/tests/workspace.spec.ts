/** The remote-workspace anchor seam: path safety, ownership, and the clause. */

import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { anchorPathOf, ensureAnchor, hostForAnchor, isAnchorSegment, renderSshWorkspaceContext } from '../src/workspace.ts'
import type { SshHostConfig } from '../src/config.ts'

const home = process.env.DSH_HOME
const temporary = await mkdtemp(join(tmpdir(), 'terminal-ssh-anchor-'))
process.env.DSH_HOME = temporary

afterAll(async () => {
  if (home === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = home
  await rm(temporary, { recursive: true, force: true })
})

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
    expect(isAnchorSegment('a\\b')).toBe(false)
  })
})

describe('anchorPathOf', () => {
  it('places one host under the harness home, one segment deep', () => {
    expect(anchorPathOf('seetacloud')).toBe(join(temporary, 'remote-workspaces', 'seetacloud'))
  })

  it('refuses names that would escape the anchor root', () => {
    expect(() => anchorPathOf('../escape')).toThrow('cannot anchor a remote workspace')
  })
})

describe('ensureAnchor', () => {
  it('creates the directory for later stat-backed workspace adoption', async () => {
    const anchor = await ensureAnchor('lab')
    expect((await stat(anchor)).isDirectory()).toBe(true)
  })
})

describe('hostForAnchor', () => {
  it('maps a cwd under one host anchor back to that host', () => {
    const anchor = anchorPathOf('seetacloud')
    expect(hostForAnchor(join(anchor, 'sub', 'dir'), [host])).toEqual(host)
    expect(hostForAnchor(anchor, [host])).toEqual(host)
  })

  it('ignores sibling directories, other hosts, and disabled hosts', () => {
    const sibling = anchorPathOf('seetacloud') + '-other'
    expect(hostForAnchor(sibling, [host])).toBeUndefined()
    expect(hostForAnchor(anchorPathOf('other'), [host])).toBeUndefined()
    expect(hostForAnchor(anchorPathOf('seetacloud'), [{ ...host, enabled: false }])).toBeUndefined()
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

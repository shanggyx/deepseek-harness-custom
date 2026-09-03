/** The create verb's sshHost dispatch: anchor resolution, ambiguity, loud gaps. */

import { describe, expect, it, vi } from 'vitest'
import { WorkspaceCommands } from '../src/commands.ts'

function ctxWith(anchors: { anchorOf(name: string): Promise<string> } | undefined) {
  const registry = {
    resolveByPath: vi.fn(async () => undefined),
    create: vi.fn(async (path: string) => ({
      id: 'w-1', path, title: path.split(/[/\\]/).pop() ?? path,
      sessionIds: [], setTitle: vi.fn(), attachSession: vi.fn(),
    })),
  }
  const ctx = {
    workspaceRegistry: registry,
    get: (name: string) => (name === 'sshWorkspace' ? anchors : undefined),
  }
  return { ctx: ctx as never, registry }
}

describe('WorkspaceCommands.create sshHost dispatch', () => {
  it('creates the workspace over the resolved anchor directory', async () => {
    const anchorOf = vi.fn(async (name: string) => `/home/user/.dsh/remote-workspaces/${name}`)
    const { ctx, registry } = ctxWith({ anchorOf })
    const commands = new WorkspaceCommands(ctx)

    const result = await commands.create({ sshHost: 'seetacloud' })

    expect(anchorOf).toHaveBeenCalledWith('seetacloud')
    expect(registry.create).toHaveBeenCalledWith('/home/user/.dsh/remote-workspaces/seetacloud')
    expect(result.created).toBe(true)
    expect(result.workspace.path).toBe('/home/user/.dsh/remote-workspaces/seetacloud')
  })

  it('refuses a request carrying both path and sshHost', async () => {
    const { ctx, registry } = ctxWith({ anchorOf: vi.fn() })
    const commands = new WorkspaceCommands(ctx)

    await expect(commands.create({ path: '/tmp/x', sshHost: 'seetacloud' }))
      .rejects.toMatchObject({ failure: { code: 'bad-request' } })
    expect(registry.create).not.toHaveBeenCalled()
  })

  it('refuses a request carrying neither field', async () => {
    const { ctx, registry } = ctxWith({ anchorOf: vi.fn() })
    const commands = new WorkspaceCommands(ctx)

    await expect(commands.create({})).rejects.toMatchObject({ failure: { code: 'bad-request' } })
    expect(registry.create).not.toHaveBeenCalled()
  })

  it('fails loud when the deployment composes no SSH terminal backend', async () => {
    const { ctx, registry } = ctxWith(undefined)
    const commands = new WorkspaceCommands(ctx)

    await expect(commands.create({ sshHost: 'seetacloud' }))
      .rejects.toMatchObject({ failure: { code: 'ssh-workspace-unavailable' } })
    expect(registry.create).not.toHaveBeenCalled()
  })

  it('maps an unknown or disabled host to a loud ssh-host-unknown failure', async () => {
    const { ctx, registry } = ctxWith({
      anchorOf: vi.fn(async () => { throw new Error('terminal-ssh: no enabled ssh host "ghost"') }),
    })
    const commands = new WorkspaceCommands(ctx)

    await expect(commands.create({ sshHost: 'ghost' }))
      .rejects.toMatchObject({ failure: { code: 'ssh-host-unknown' } })
    expect(registry.create).not.toHaveBeenCalled()
  })
})

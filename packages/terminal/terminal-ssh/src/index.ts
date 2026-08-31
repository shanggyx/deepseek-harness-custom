/**
 * SSH PTY backend over the DeepSeek Harness subprocess terminal primitive:
 * one persistent remote shell session per configured host, spawned through
 * the local `ssh` client. Sessions are interactive by design — the remote
 * banner, password prompts, and the remote shell are all driven by the
 * owner's sends, so password-authenticated hosts work without storing
 * secrets. Remote execution is deliberately outside the local sandbox.
 * @module @deepseek-ai/dsh-terminal-ssh
 */

import type { Context } from '@deepseek-ai/cordis'
import type { TerminalBackend, TerminalBackendSession, TerminalBackendSpawnSpec } from '@deepseek-ai/dsh-terminal'
import { LocalPtySession, resolveConfig, type ResolvedConfig } from '@deepseek-ai/dsh-terminal-bash'
import type { SubprocessTerminalHandle, SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { resolveHosts, type Config, type SshHostConfig } from './config.ts'

export { Config, resolveHosts } from './config.ts'
export type { SshHostConfig } from './config.ts'

/** Stable Cordis plugin name. */
export const name = 'terminal-ssh'

/** Services required before the backends can spawn sessions. */
export const inject = ['terminals', 'subprocess']

/**
 * Compose the ssh client argv for one host: port, optional explicit identity
 * (with `IdentitiesOnly` so a provided key is the one that authenticates),
 * accept-new host keys, then the login target. ssh's own default identity
 * files are always tried before an explicit one.
 * @param host - the resolved host configuration.
 * @returns the ssh argv.
 */
export function sshArgv(host: SshHostConfig): string[] {
  const argv = ['ssh', '-p', String(host.port)]
  if (host.identityFile !== undefined) {
    argv.push('-i', host.identityFile, '-o', 'IdentitiesOnly=yes')
  }
  argv.push('-o', 'StrictHostKeyChecking=accept-new', `${host.username}@${host.host}`)
  return argv
}

/** SSH backend for one configured host, registered under `ssh:<name>`. */
export class SshTerminalBackend implements TerminalBackend {
  readonly type: string

  constructor(
    private readonly host: SshHostConfig,
    private readonly sessionConfig: ResolvedConfig & { cwd: string },
    private readonly spawnTerminal: (
      spec: SubprocessTerminalSpawnSpec,
    ) => Promise<SubprocessTerminalHandle>,
  ) {
    this.type = `ssh:${host.name}`
  }

  async spawn(spec: TerminalBackendSpawnSpec): Promise<TerminalBackendSession> {
    spec.signal?.throwIfAborted()
    const terminal = await this.spawnTerminal({
      argv: sshArgv(this.host),
      cwd: this.sessionConfig.cwd,
      rows: this.sessionConfig.rows,
      cols: this.sessionConfig.cols,
      graceMs: this.sessionConfig.disposeGraceMs,
      signal: spec.signal,
    })
    // No startup handshake: an SSH session opens straight onto the remote
    // banner/login/shell, all of which belong to the owner's sends.
    return new LocalPtySession(terminal, this.sessionConfig)
  }
}

/**
 * Register one SSH backend per configured host.
 * @param ctx - plugin context carrying the terminals registry and subprocess seam.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const sessionConfig = {
    ...resolveConfig(config),
    cwd: process.cwd(),
  }
  for (const host of resolveHosts(config)) {
    ctx.terminals.registerBackend(new SshTerminalBackend(host, sessionConfig, async spec => ctx.subprocess.spawnTerminal(spec)))
  }
}

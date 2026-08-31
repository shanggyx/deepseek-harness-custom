/**
 * SSH PTY backend over the DeepSeek Harness subprocess terminal primitive:
 * one persistent remote shell session per configured host, spawned through
 * the local `ssh` client. Sessions are interactive by design — the remote
 * banner, password prompts, and the remote shell are all driven by the
 * owner's sends, so password-authenticated hosts work without storing
 * secrets. Remote execution is deliberately outside the local sandbox.
 *
 * Hosts come from two places merged by name (settings wins): the plugin
 * configuration (composition ships defaults) and the user-managed
 * `terminal-ssh` settings section (the GUI the settings plugins surface
 * edits). Settings changes re-register the affected backends in place.
 * @module @deepseek-ai/dsh-terminal-ssh
 */

import type { Context } from '@deepseek-ai/cordis'
import type { TerminalBackend, TerminalBackendSession, TerminalBackendSpawnSpec } from '@deepseek-ai/dsh-terminal'
import { LocalPtySession, resolveConfig, type ResolvedConfig } from '@deepseek-ai/dsh-terminal-bash'
import type { SubprocessTerminalHandle, SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { resolveHosts, type Config, type SshHostConfig } from './config.ts'
import {
  SshHostsSettingsSchema, sshSettingsNamespace, type SshHostsDocument,
} from './settings.ts'

export { Config, resolveHosts } from './config.ts'
export type { SshHostConfig } from './config.ts'
export { SSH_SETTINGS_NAMESPACE, sshSettingsNamespace, SshHostsSettingsSchema } from './settings.ts'
export type { SshHostsDocument } from './settings.ts'

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
 * Merge the two host sources by name: composition hosts ship defaults, the
 * settings document carries user-managed entries, and a settings entry
 * replaces a composition host of the same name.
 * @param composition - hosts from the plugin configuration.
 * @param managed - hosts from the user settings document.
 * @returns the merged roster in insertion order (composition first).
 */
function mergeHosts(composition: readonly SshHostConfig[], managed: readonly SshHostConfig[]): SshHostConfig[] {
  const byName = new Map<string, SshHostConfig>()
  for (const host of composition) byName.set(host.name, host)
  for (const host of managed) byName.set(host.name, host)
  return [...byName.values()]
}

/**
 * Register one SSH backend per host (composition hosts merged with the
 * user-managed settings hosts), replacing the previous registration set.
 * @param ctx - plugin context carrying the terminals registry and subprocess seam.
 * @param sessionConfig - shared PTY tuning for every spawned session.
 * @param hosts - the merged host roster.
 * @param disposers - mutable disposer bag for the current registrations.
 */
function registerBackends(
  ctx: Context,
  sessionConfig: ResolvedConfig & { cwd: string },
  hosts: readonly SshHostConfig[],
  disposers: (() => void)[],
): void {
  for (const dispose of disposers.splice(0)) dispose()
  for (const host of hosts) {
    disposers.push(
      ctx.terminals.registerBackend(
        new SshTerminalBackend(host, sessionConfig, async spec => ctx.subprocess.spawnTerminal(spec)),
      ),
    )
  }
}

/**
 * Register the SSH backends and keep them in step with the user settings
 * document. Composition hosts ship defaults; the settings document carries
 * the user's own hosts and wins per name.
 * @param ctx - plugin context carrying the terminals registry and subprocess seam.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const sessionConfig: ResolvedConfig & { cwd: string } = {
    ...resolveConfig(config),
    cwd: process.cwd(),
  }
  const compositionHosts = resolveHosts(config)
  const disposers: (() => void)[] = []
  registerBackends(ctx, sessionConfig, compositionHosts, disposers)

  // The user settings document carries the GUI-managed hosts; a refresh
  // (commit from the settings UI) re-registers the merged roster in place.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(sshSettingsNamespace, SshHostsSettingsSchema)
    const readManaged = (): SshHostConfig[] => {
      const document = settingsCtx.settings.get(sshSettingsNamespace) as SshHostsDocument | undefined
      return document?.hosts ?? []
    }
    const rebind = (): void => {
      const previous = disposers.splice(0)
      const hosts = mergeHosts(compositionHosts, readManaged())
      for (const host of hosts) {
        disposers.push(
          ctx.terminals.registerBackend(
            new SshTerminalBackend(host, sessionConfig, async spec => ctx.subprocess.spawnTerminal(spec)),
          ),
        )
      }
      for (const dispose of previous) dispose()
    }
    settingsCtx.on('settings/document-updated', rebind)
    rebind()
  })
}

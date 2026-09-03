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
import { Service } from '@deepseek-ai/cordis'
import { resolveHosts, type Config, type SshHostConfig } from './config.ts'
import {
  SshHostsSettingsSchema, sshSettingsNamespace, type SshHostsDocument,
} from './settings.ts'
import { defaultAnchorRoot, ensureAnchor, hostForAnchor, renderSshWorkspaceContext } from './workspace.ts'

export { Config, resolveHosts } from './config.ts'
export type { SshHostConfig } from './config.ts'
export { SSH_SETTINGS_NAMESPACE, sshSettingsNamespace, SshHostsSettingsSchema } from './settings.ts'
export type { SshHostsDocument } from './settings.ts'
export {
  REMOTE_WORKSPACES_DIR, anchorPathOf, defaultAnchorRoot, ensureAnchor, hostForAnchor,
  isAnchorSegment, renderSshWorkspaceContext,
} from './workspace.ts'

/** Stable Cordis plugin name. */
export const name = 'terminal-ssh'

/** Services required before the backends can spawn sessions. */
export const inject = ['terminals', 'subprocess']

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Anchor-directory resolution for SSH hosts' remote workspaces. */
    sshWorkspace: SshWorkspaceAnchors
  }
}

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

/** Hosts that get a registered backend: the roster minus toggled-off entries. */
function activeHosts(hosts: readonly SshHostConfig[]): SshHostConfig[] {
  return hosts.filter(host => host.enabled !== false)
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
  for (const host of activeHosts(hosts)) {
    disposers.push(
      ctx.terminals.registerBackend(
        new SshTerminalBackend(host, sessionConfig, async spec => ctx.subprocess.spawnTerminal(spec)),
      ),
    )
  }
}

/**
 * Resolves the local anchor directory of one host's remote workspace over the
 * live merged roster. Consumed by the workspace controller's `create` verb;
 * unknown or disabled names fail loud at the call, not at activation.
 */
export class SshWorkspaceAnchors extends Service {
  /** @param ctx - Host context. @param roster - the live merged host roster. @param root - the anchor root directory. */
  constructor(
    ctx: Context,
    private readonly roster: () => readonly SshHostConfig[],
    private readonly root: string,
  ) {
    super(ctx, 'sshWorkspace')
  }

  /**
   * Ensure and return one host's anchor directory.
   * @param name - the host's roster name.
   * @returns the created (or existing) anchor directory path.
   * @throws when no enabled host carries that name or the name cannot embed
   *   as one anchor path segment.
   */
  async anchorOf(name: string): Promise<string> {
    const host = this.roster().find(candidate => candidate.name === name)
    if (host === undefined || host.enabled === false) {
      throw new Error(`terminal-ssh: no enabled ssh host ${JSON.stringify(name)}`)
    }
    return ensureAnchor(name, this.root)
  }
}

/**
 * Register the SSH backends and keep them in step with the user settings
 * document. Composition hosts ship defaults; the settings document carries
 * the user's own hosts and wins per name. Also owns the remote-workspace
 * seam: the anchor-directory service the workspace controller creates
 * workspaces through, and the prompt clause that directs a session anchored
 * on one host to work through its `ssh:<name>` terminal.
 * @param ctx - plugin context carrying the terminals registry and subprocess seam.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const sessionConfig: ResolvedConfig & { cwd: string } = {
    ...resolveConfig(config),
    cwd: process.cwd(),
  }
  const compositionHosts = resolveHosts(config)
  // Explicit resolve step: an absent or empty config value picks the OS temp
  // directory, so anchors never land in the user's profile by default.
  const anchorRoot = config.remoteWorkspaceRoot !== undefined && config.remoteWorkspaceRoot.length > 0
    ? config.remoteWorkspaceRoot
    : defaultAnchorRoot()
  let roster: readonly SshHostConfig[] = compositionHosts
  const disposers: (() => void)[] = []
  registerBackends(ctx, sessionConfig, compositionHosts, disposers)

  // The workspace controller resolves `create { sshHost }` against the live
  // roster through this service; the clause below reads the same roster.
  new SshWorkspaceAnchors(ctx, () => roster, anchorRoot)

  // Model-visible ⟺ logged: the clause rides the runtime-context snapshot
  // (a `user/message` event) on the session's first assembled request.
  ctx.inject(['systemPrompt'], (scope: Context) => {
    scope.systemPrompt.context({
      name: 'ssh:workspace',
      order: 115,
      text: (context) => {
        const cwd = context.agent?.session.header.cwd
        if (cwd === undefined) return ''
        const host = hostForAnchor(cwd, roster, anchorRoot)
        return host === undefined ? '' : renderSshWorkspaceContext(host)
      },
    })
  })

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
      const merged = mergeHosts(compositionHosts, readManaged())
      roster = merged
      for (const host of activeHosts(merged)) {
        disposers.push(
          ctx.terminals.registerBackend(
            new SshTerminalBackend(host, sessionConfig, async spec => ctx.subprocess.spawnTerminal(spec)),
          ),
        )
      }
      for (const dispose of previous) dispose()
      // OS temp cleanup can wipe anchors between runs; rebuild them so
      // existing remote workspaces keep attaching sessions. A failure here
      // resurfaces loudly when a workspace is actually created.
      for (const host of activeHosts(merged)) {
        void ensureAnchor(host.name, anchorRoot).catch(() => undefined)
      }
    }
    settingsCtx.on('settings/document-updated', rebind)
    rebind()
  })
}

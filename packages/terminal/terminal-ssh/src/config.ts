/** Validated configuration for the SSH terminal backend. */

import z from '@deepseek-ai/schemastery'

/** One configured SSH host; the backend type is `ssh:<name>`. */
export interface SshHostConfig {
  /** Registry-unique backend suffix (`ssh:<name>`). */
  name: string
  /** Remote host name or IP. */
  host: string
  /** Remote SSH port. */
  port: number
  /** Remote login user. */
  username: string
  /** Optional explicit identity file; ssh's default identities are always tried first. */
  identityFile?: string
}

/** Public plugin configuration. */
export interface Config {
  /** Configured SSH hosts; each registers one `ssh:<name>` backend. */
  hosts?: SshHostConfig[]
  /** Terminal rows. */
  rows?: number
  /** Terminal columns. */
  cols?: number
  /** Maximum retained logical lines. */
  scrollbackLines?: number
  /** Maximum retained UTF-8 bytes. */
  scrollbackMaxBytes?: number
  /** Maximum bytes returned by one read or settled viewport. */
  maxReadBytes?: number
  /** Readiness polling interval. */
  pollIntervalMs?: number
  /** Delay before Linux exact syscall probes. */
  exactProbeAfterMs?: number
  /** Silence duration that yields `inferred_idle`. */
  idleSilenceMs?: number
  /**
   * Extra wait beyond `idleSilenceMs`, once a prompt marker was seen, for the shell to
   * regain the foreground before `inferred_idle` settles; at least one `pollIntervalMs`.
   */
  handoffGraceMs?: number
  /** Absolute bound for one send. */
  timeoutMs?: number
  /** Grace before teardown escalates to `SIGKILL`. */
  disposeGraceMs?: number
  /** Local process working directory for the ssh client (carries no remote meaning). */
  cwd?: string
}

/** Configuration after Schemastery defaults. */
export type ResolvedConfig = Required<Config>

/** Schemastery config exposed by the plugin; the session tuning defaults mirror terminal-bash. */
export const Config: z<Config> = z.object({
  hosts: z.array(
    z.object({
      name: z.string(),
      host: z.string(),
      port: z.number().default(22),
      username: z.string(),
      identityFile: z.string().required(false),
    }),
  ).default([]),
  rows: z.number().default(40),
  cols: z.number().default(160),
  scrollbackLines: z.number().default(10_000),
  scrollbackMaxBytes: z.number().default(4 * 1024 * 1024),
  maxReadBytes: z.number().default(256 * 1024),
  pollIntervalMs: z.number().default(50),
  exactProbeAfterMs: z.number().default(150),
  idleSilenceMs: z.number().default(3_000),
  handoffGraceMs: z.number().default(500),
  timeoutMs: z.number().default(30_000),
  disposeGraceMs: z.number().default(3_000),
})

/**
 * Resolve host defaults and validate the configuration fails loud: every host
 * needs a unique non-empty name, a non-empty host and username, and a
 * positive port.
 * @param config - Schemastery-resolved plugin configuration.
 * @returns the resolved host list.
 */
export function resolveHosts(config: Config): SshHostConfig[] {
  const seen = new Set<string>()
  return (config.hosts ?? []).map((host) => {
    const label = `terminal-ssh: host ${JSON.stringify(host.name)}`
    if (host.name.length === 0) throw new Error(`${label}: name must be non-empty`)
    if (seen.has(host.name)) throw new Error(`${label}: duplicate host name`)
    seen.add(host.name)
    if (host.host.length === 0) throw new Error(`${label}: host must be non-empty`)
    if (host.username.length === 0) throw new Error(`${label}: username must be non-empty`)
    const port = host.port ?? 22
    if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) {
      throw new Error(`${label}: port must be a positive port number`)
    }
    return {
      name: host.name,
      host: host.host,
      port,
      username: host.username,
      ...(host.identityFile !== undefined && { identityFile: host.identityFile }),
    }
  })
}

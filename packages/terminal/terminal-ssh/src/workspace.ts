/** SSH 远程工作区锚点：每台启用主机在本地文件系统上的落点目录与会话提示子句。 */

import { mkdir } from 'node:fs/promises'
import { sep } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { SshHostConfig } from './config.ts'

/** The harness-home subdirectory holding every host's anchor directory. */
export const REMOTE_WORKSPACES_DIR = 'remote-workspaces'

/**
 * Whether a host name can embed as one anchor path segment.
 * @param name - the host's roster name.
 * @returns true when the name is non-empty, not a dot segment, and carries no path separator.
 */
export function isAnchorSegment(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..'
    && !name.includes('/') && !name.includes('\\')
}

/**
 * The absolute local anchor directory of one host's remote workspace — a real
 * directory so the workspace registry, sandbox, and persistence keep treating
 * the session as local, while the prompt clause directs work to the host.
 * @param name - the host's roster name.
 * @returns the anchor directory path.
 * @throws when the name cannot embed as one path segment.
 */
export function anchorPathOf(name: string): string {
  if (!isAnchorSegment(name)) {
    throw new Error(`terminal-ssh: host ${JSON.stringify(name)} cannot anchor a remote workspace`)
  }
  return dshHomePath(REMOTE_WORKSPACES_DIR, name)
}

/**
 * Create one host's anchor directory if absent.
 * @param name - the host's roster name.
 * @returns the anchor directory path.
 */
export async function ensureAnchor(name: string): Promise<string> {
  const anchor = anchorPathOf(name)
  await mkdir(anchor, { recursive: true })
  return anchor
}

/**
 * The enabled host whose anchor directory contains the given cwd, if any.
 * Comparison is case-insensitive where the platform's paths are.
 * @param cwd - the session's canonical working directory.
 * @param hosts - the merged host roster.
 * @returns the host owning that anchor, or undefined.
 */
export function hostForAnchor(cwd: string, hosts: readonly SshHostConfig[]): SshHostConfig | undefined {
  const fold = (value: string): string => (process.platform === 'win32' ? value.toLowerCase() : value)
  const folded = fold(cwd)
  return hosts.find((host) => {
    if (host.enabled === false || !isAnchorSegment(host.name)) return false
    const anchor = fold(anchorPathOf(host.name))
    return folded === anchor || folded.startsWith(anchor + sep)
  })
}

/**
 * Render the model-visible clause directing work to the remote host.
 * @param host - the roster host the session's anchor maps to.
 * @returns the clause text.
 */
export function renderSshWorkspaceContext(host: SshHostConfig): string {
  return [
    `This session's workspace is the local anchor of the remote host ${host.name}`,
    `(${host.username}@${host.host}:${String(host.port)}).`,
    'Work on the remote host: open a persistent terminal with the terminal_open tool',
    `using type "ssh:${host.name}", and run every remote command and file inspection there.`,
    'The remote login directory is your working directory on that host.',
    'The local anchor directory holds no project files — do not use the local file tools',
    'for the remote machine\'s files; read remote output from the terminal session.',
  ].join(' ')
}

/** 用户可用 GUI 管理的 SSH 主机清单：存放在 user-settings 文档的 `terminal-ssh` 段。 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SshHostConfig } from './config.ts'

/** Settings namespace owned by the SSH terminal plugin. */
export const SSH_SETTINGS_NAMESPACE = 'terminal-ssh'

/** 用户经 GUI 维护的主机清单文档。 */
export interface SshHostsDocument {
  hosts: SshHostConfig[]
}

/** 文档 schema（含默认空清单）。 */
export const SshHostsSettingsSchema: z<SshHostsDocument> = z.object({
  hosts: z.array(
    z.object({
      name: z.string(),
      host: z.string(),
      port: z.number().default(22),
      username: z.string(),
      identityFile: z.string().required(false),
      enabled: z.boolean().required(false),
    }),
  ).default([]),
})

/** The settings namespace handle. */
export const sshSettingsNamespace = settingsNamespace(SSH_SETTINGS_NAMESPACE)

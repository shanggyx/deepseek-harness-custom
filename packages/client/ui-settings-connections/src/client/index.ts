/**
 * Connections settings surface, browser half — one section whose card edits
 * the user-managed SSH remote-host roster in the `terminal-ssh` settings
 * namespace. The section rides the settings shell's `settings.section` seat;
 * a deployment that composes no `terminal-ssh` plugin leaves the namespace
 * unserved and the section says so instead of rendering a dead form.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry)
// and the ctx.settingsScope Context merge. Cross-plugin collaboration goes
// through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ConnectionsSection } from './ConnectionsSection.tsx'
import { en, zh, type ConnectionsLocaleKey } from './locales.ts'
import {
  SSH_NS, createSshHostsCardController, decodeSshHostsDocument,
} from './ssh-hosts-card-controller.ts'

export type { ConnectionsSectionProps } from './ConnectionsSection.tsx'
export type { SshHostsCardProps } from './SshHostsCard.tsx'
export type { ConnectionsLocaleKey } from './locales.ts'
export type {
  SshHostRow, SshHostsCardActions, SshHostsCardInjected, SshHostsCardState, SshHostsDocument,
} from './ssh-hosts-card-controller.ts'
export {
  SSH_NS, createSshHostsCardController, decodeSshHostsDocument,
} from './ssh-hosts-card-controller.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Connections section + SSH hosts card copy. */
    'settings.connections': ConnectionsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.connections'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Mount the Connections section and its SSH hosts card.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-connections: section dictionaries')

  const sshHosts = createSshHostsCardController(ctx.settingsScope.bind({
    namespace: SSH_NS,
    decode: decodeSshHostsDocument,
  }))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'connections',
    order: 12,
    label: () => t('nav'),
    locale: NS,
    inject: () => sshHosts.inject(),
  }, ConnectionsSection))
}

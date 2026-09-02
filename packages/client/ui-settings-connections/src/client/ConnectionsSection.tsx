/** The Connections section: the remote hosts the agent's terminal tools reach. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SshHostsCard } from './SshHostsCard.tsx'
import type { SshHostsCardInjected } from './ssh-hosts-card-controller.ts'
import css from './ConnectionsSection.module.css'

/** Props the renderer binds for the Connections section. */
export type ConnectionsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.connections'>
  & InjectFace<SshHostsCardInjected>

/**
 * Render the Connections section: heading, intro, and the SSH hosts card, or
 * the unavailable note when the deployment composes no `terminal-ssh` plugin.
 * @param props - composed slot props (the section owner share plus the card's
 *   injected face).
 * @returns the section element tree.
 */
export function ConnectionsSection(props: ConnectionsSectionProps) {
  const { t } = props
  const state = props.useSshHosts(snapshot => snapshot)
  const actions = {
    editRow: props.editRow,
    toggleRow: props.toggleRow,
    addRow: props.addRow,
    removeRow: props.removeRow,
    save: props.save,
  }
  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {state.available
        ? <SshHostsCard t={t} state={state} actions={actions} />
        : <p className={css.empty}>{t('unavailable')}</p>}
    </div>
  )
}

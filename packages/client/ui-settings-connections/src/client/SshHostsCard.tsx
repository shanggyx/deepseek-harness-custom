/** The SSH hosts card: the user-managed roster the agent's terminal tools reach. */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SshHostsCardActions, SshHostsCardState } from './ssh-hosts-card-controller.ts'
import css from './SshHostsCard.module.css'

/** Props the Connections section binds for the card: copy, snapshot, and actions. */
export type SshHostsCardProps = {
  /** Section translate seat. */
  t: TranslateNS<'settings.connections'>
  /** The card snapshot. */
  state: SshHostsCardState
  /** The card's row and save actions. */
  actions: SshHostsCardActions
}

/**
 * Render the SSH hosts card.
 * @param props - locale copy, the card snapshot, and its row actions.
 * @returns the card.
 */
export function SshHostsCard(props: SshHostsCardProps) {
  const { t, state, actions } = props
  const disabled = !state.writable
  return (
    <div className={css.card}>
      <div className={css.head}>
        <span className={css.title}>{t('sshTitle')}</span>
        <span className={css.hint}>{t('sshHint')}</span>
      </div>
      {state.hosts.map((row, index) => (
        <div key={index} className={css.row}>
          <input
            className={css.input}
            aria-label={t('sshName')}
            placeholder="my-server"
            value={row.name}
            disabled={disabled}
            onChange={(event) => { actions.editRow(index, { name: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshHost')}
            placeholder="host"
            value={row.host}
            disabled={disabled}
            onChange={(event) => { actions.editRow(index, { host: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshPort')}
            placeholder="22"
            value={String(row.port)}
            disabled={disabled}
            onChange={(event) => { actions.editRow(index, { port: Number.parseInt(event.target.value, 10) || 22 }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshUser')}
            placeholder="root"
            value={row.username}
            disabled={disabled}
            onChange={(event) => { actions.editRow(index, { username: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshIdentity')}
            placeholder="~/.ssh/id_rsa"
            value={row.identityFile}
            disabled={disabled}
            onChange={(event) => { actions.editRow(index, { identityFile: event.target.value }) }}
          />
          <button
            type="button"
            className={css.remove}
            aria-label={t('sshRemove')}
            disabled={disabled}
            onClick={() => { actions.removeRow(index) }}
          >
            ✕
          </button>
        </div>
      ))}
      {state.failed && <span className={css.hint}>{t('sshSaveFailed')}</span>}
      <div className={css.actions}>
        <button
          type="button"
          className={css.secondary}
          disabled={disabled}
          onClick={() => { actions.addRow() }}
        >
          {t('sshAdd')}
        </button>
        <button
          type="button"
          className={css.secondary}
          disabled={disabled || state.saving}
          onClick={() => { actions.save() }}
        >
          {t('sshSave')}
        </button>
      </div>
    </div>
  )
}

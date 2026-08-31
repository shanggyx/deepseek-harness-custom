/** The SSH plugin's card: manage the remote hosts the agent's terminal tools reach. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SshHostsCardInjected } from './ssh-hosts-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './ssh-hosts-card.module.css'

/** Props the renderer binds for the SSH hosts card. */
export type SshHostsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<SshHostsCardInjected>

/**
 * Render the SSH hosts card.
 * @param props - locale copy, the card snapshot, and its row actions.
 * @returns the card.
 */
export function SshHostsCard(props: SshHostsCardProps) {
  const { t } = props
  const state = props.useSshHosts(snapshot => snapshot)
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
            onChange={(event) => { props.editRow(index, { name: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshHost')}
            placeholder="host"
            value={row.host}
            disabled={disabled}
            onChange={(event) => { props.editRow(index, { host: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshPort')}
            placeholder="22"
            value={String(row.port)}
            disabled={disabled}
            onChange={(event) => { props.editRow(index, { port: Number.parseInt(event.target.value, 10) || 22 }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshUser')}
            placeholder="root"
            value={row.username}
            disabled={disabled}
            onChange={(event) => { props.editRow(index, { username: event.target.value }) }}
          />
          <input
            className={css.input}
            aria-label={t('sshIdentity')}
            placeholder="~/.ssh/id_rsa"
            value={row.identityFile}
            disabled={disabled}
            onChange={(event) => { props.editRow(index, { identityFile: event.target.value }) }}
          />
          <button
            type="button"
            className={css.remove}
            aria-label={t('sshRemove')}
            disabled={disabled}
            onClick={() => { props.removeRow(index) }}
          >
            ✕
          </button>
        </div>
      ))}
      <div className={css.actions}>
        <button
          type="button"
          className={css.secondary}
          disabled={disabled}
          onClick={() => { props.addRow() }}
        >
          {t('sshAdd')}
        </button>
        <button
          type="button"
          className={css.secondary}
          disabled={disabled || state.saving}
          onClick={() => { props.save() }}
        >
          {t('sshSave')}
        </button>
      </div>
    </div>
  )
}

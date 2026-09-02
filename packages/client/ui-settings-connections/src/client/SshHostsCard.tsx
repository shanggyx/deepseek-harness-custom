/** The SSH hosts roster: one toggleable card per remote host, Codex-style. */

import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SshHostRow, SshHostsCardActions, SshHostsCardState } from './ssh-hosts-card-controller.ts'
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

/** The `user@host:port` endpoint line of one host row. */
export function endpointOf(row: SshHostRow): string {
  return `${row.username}@${row.host}:${String(row.port)}`
}

/**
 * Render the SSH hosts roster: a header row with the add action, then one
 * toggleable card per host. The switch applies immediately; the pencil
 * expands the row's five fields for editing, staged until 保存.
 * @param props - locale copy, the card snapshot, and its row actions.
 * @returns the roster.
 */
export function SshHostsCard(props: SshHostsCardProps) {
  const { t, state, actions } = props
  const disabled = !state.writable
  const [editing, setEditing] = useState<number | undefined>(undefined)
  return (
    <section className={css.card}>
      <div className={css.head}>
        <div className={css.headText}>
          <span className={css.title}>{t('sshTitle')}</span>
          <span className={css.hint}>{t('sshHint')}</span>
        </div>
        <button
          type="button"
          className={css.add}
          disabled={disabled}
          onClick={() => {
            actions.addRow()
            setEditing(state.hosts.length)
          }}
        >
          {t('sshAdd')}
        </button>
      </div>
      {state.hosts.map((row, index) => (
        <div key={index} className={css.hostCard}>
          <div className={css.row}>
            <button
              type="button"
              role="switch"
              aria-checked={row.enabled}
              aria-label={`${t('sshName')} ${row.name || index + 1}`}
              className={row.enabled ? `${css.switch} ${css.switchOn}` : css.switch}
              disabled={disabled}
              onClick={() => { actions.toggleRow(index) }}
            >
              <span className={css.thumb} />
            </button>
            <div className={css.identity}>
              <span className={css.name}>{row.name}</span>
              <span className={css.endpoint}>{endpointOf(row)}</span>
            </div>
            <span className={css.status}>
              <span className={row.enabled ? `${css.dot} ${css.dotOn}` : css.dot} />
              {row.enabled ? t('sshEnabled') : t('sshDisabled')}
            </span>
            <button
              type="button"
              className={css.iconBtn}
              aria-label={t('sshEdit')}
              aria-expanded={editing === index}
              disabled={disabled}
              onClick={() => { setEditing(editing === index ? undefined : index) }}
            >
              ✎
            </button>
            <button
              type="button"
              className={css.iconBtn}
              aria-label={t('sshRemove')}
              disabled={disabled}
              onClick={() => {
                if (editing === index) setEditing(undefined)
                actions.removeRow(index)
              }}
            >
              ✕
            </button>
          </div>
          {editing === index && (
            <div className={css.fields}>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('sshName')}</span>
                <input
                  className={css.input}
                  placeholder="my-server"
                  value={row.name}
                  disabled={disabled}
                  onChange={(event) => { actions.editRow(index, { name: event.target.value }) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('sshHost')}</span>
                <input
                  className={css.input}
                  placeholder="host"
                  value={row.host}
                  disabled={disabled}
                  onChange={(event) => { actions.editRow(index, { host: event.target.value }) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('sshPort')}</span>
                <input
                  className={css.input}
                  placeholder="22"
                  inputMode="numeric"
                  value={String(row.port)}
                  disabled={disabled}
                  onChange={(event) => { actions.editRow(index, { port: Number.parseInt(event.target.value, 10) || 22 }) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('sshUser')}</span>
                <input
                  className={css.input}
                  placeholder="root"
                  value={row.username}
                  disabled={disabled}
                  onChange={(event) => { actions.editRow(index, { username: event.target.value }) }}
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>{t('sshIdentity')}</span>
                <input
                  className={css.input}
                  placeholder="~/.ssh/id_rsa"
                  value={row.identityFile}
                  disabled={disabled}
                  onChange={(event) => { actions.editRow(index, { identityFile: event.target.value }) }}
                />
              </label>
            </div>
          )}
        </div>
      ))}
      {state.failed && <span className={css.hint}>{t('sshSaveFailed')}</span>}
      <div className={css.actions}>
        <button
          type="button"
          className={css.secondary}
          disabled={disabled || state.saving}
          onClick={() => { actions.save() }}
        >
          {t('sshSave')}
        </button>
      </div>
    </section>
  )
}

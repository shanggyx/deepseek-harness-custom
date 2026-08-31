/**
 * SSH hosts card controller: binds the `terminal-ssh` settings namespace and
 * stages the user-managed host roster. Edits live in the card's draft; 保存
 * writes the whole roster as one document-section mutation. The preset
 * composition's own hosts live in a different layer and are untouched here.
 * @module ssh-hosts-card-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'

/** The settings namespace this card edits. */
export const SSH_NS = 'terminal-ssh'

/** One user-managed SSH host row. */
export interface SshHostRow {
  name: string
  host: string
  port: number
  username: string
  identityFile: string
}

/** What the card renders. */
export interface SshHostsCardState {
  /** False while the namespace is not served to this client; the card renders nothing. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Whether a save is crossing the wire. */
  saving: boolean
  /** Whether the last save did not land as staged; cleared by the next edit or save. */
  failed: boolean
  /** Draft roster. */
  hosts: SshHostRow[]
}

/** The writes the card performs. */
export interface SshHostsCardActions {
  /** Patch one host row in the draft. */
  editRow: (index: number, patch: Partial<SshHostRow>) => void
  /** Append one empty row. */
  addRow: () => void
  /** Remove one row from the draft. */
  removeRow: (index: number) => void
  /** Write the draft roster to the Host document. */
  save: () => void
}

/** The face the slot registration injects into the card component. */
export interface SshHostsCardInjected {
  hooks: { sshHosts: SnapshotStore<SshHostsCardState> }
  editRow: SshHostsCardActions['editRow']
  addRow: SshHostsCardActions['addRow']
  removeRow: SshHostsCardActions['removeRow']
  save: SshHostsCardActions['save']
}

/**
 * Create the SSH hosts card controller over one settings scope.
 * @param scope - the bound settings scope for the `terminal-ssh` namespace.
 * @returns the controller's state store, actions, and slot-injection face.
 */
export function createSshHostsCardController(scope: SettingsScope<SshHostsCardState>): {
  store: SnapshotStore<SshHostsCardState>
  actions: SshHostsCardActions
  inject(): SshHostsCardInjected
} {
  let saving = false
  let failed = false
  let hosts: SshHostRow[] = []
  const store = createSnapshotStore<SshHostsCardState>({
    available: false, writable: false, saving: false, failed: false, hosts: [],
  })

  function publish(patch: Partial<SshHostsCardState>): void {
    const current = store.getSnapshot()
    store.set({ ...current, ...patch })
  }

  function adopt(): void {
    const snapshot = scope.getSnapshot()
    hosts = (snapshot.value?.hosts ?? []).map(row => ({ ...row }))
    publish({
      available: snapshot.status !== 'unavailable',
      writable: snapshot.writable,
      saving,
      failed,
      hosts,
    })
  }

  const actions: SshHostsCardActions = {
    editRow: (index, patch) => {
      if (hosts[index] === undefined) return
      hosts[index] = { ...hosts[index], ...patch }
      publish({ hosts: hosts.map(row => ({ ...row })) })
    },
    addRow: () => {
      hosts.push({ name: '', host: '', port: 22, username: 'root', identityFile: '' })
      publish({ hosts: hosts.map(row => ({ ...row })) })
    },
    removeRow: (index) => {
      if (hosts[index] === undefined) return
      hosts.splice(index, 1)
      publish({ hosts: hosts.map(row => ({ ...row })) })
    },
    save: () => {
      if (saving) return
      saving = true
      publish({ saving: true })
      void scope.set('hosts', hosts.map(row => ({ ...row }))).then(
        () => {
          saving = false
          publish({ saving: false })
        },
        () => {
          saving = false
          failed = true
          publish({ saving: false, failed: true })
        },
      )
    },
  }

  scope.subscribe(() => { adopt() })
  adopt()

  return {
    store,
    actions,
    inject(): SshHostsCardInjected {
      return {
        hooks: { sshHosts: store },
        editRow: actions.editRow,
        addRow: actions.addRow,
        removeRow: actions.removeRow,
        save: actions.save,
      }
    },
  }
}

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
  /** Whether the host's backend is registered; a toggled-off host stays configured but unreachable. */
  enabled: boolean
}

/** The document the `terminal-ssh` namespace stores. */
export interface SshHostsDocument {
  /** The user-managed roster; absent resolves to an empty roster. */
  hosts?: SshHostRow[]
}

/**
 * Narrow one served `terminal-ssh` section to the roster document, normalizing
 * every row to the card's shape. Anything else decodes to nothing, so a
 * malformed section never reaches the card.
 * @param section - the wire section as stored.
 * @returns the document, or undefined when it is not a roster document.
 */
export function decodeSshHostsDocument(section: unknown): SshHostsDocument | undefined {
  if (typeof section !== 'object' || section === null || Array.isArray(section)) return undefined
  const hosts = (section as { hosts?: unknown }).hosts
  if (hosts === undefined) return {}
  if (!Array.isArray(hosts)) return undefined
  const rows: SshHostRow[] = []
  for (const entry of hosts) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined
    const row = entry as Record<string, unknown>
    if (typeof row.name !== 'string' || typeof row.host !== 'string'
      || typeof row.port !== 'number' || typeof row.username !== 'string') return undefined
    rows.push({
      name: row.name,
      host: row.host,
      port: row.port,
      username: row.username,
      identityFile: typeof row.identityFile === 'string' ? row.identityFile : '',
      enabled: row.enabled !== false,
    })
  }
  return { hosts: rows }
}

/** What the card renders. */
export interface SshHostsCardState {
  /** False while the namespace is not served to this client; the section says so instead of the card. */
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
  /** Flip one host's enabled switch and write the roster immediately. */
  toggleRow: (index: number) => void
  /** Append one empty row. */
  addRow: () => void
  /** Remove one row from the draft. */
  removeRow: (index: number) => void
  /** Write the draft roster to the Host document. */
  save: () => void
}

/** The face the slot registration injects into the section. */
export interface SshHostsCardInjected {
  hooks: { sshHosts: SnapshotStore<SshHostsCardState> }
  editRow: SshHostsCardActions['editRow']
  toggleRow: SshHostsCardActions['toggleRow']
  addRow: SshHostsCardActions['addRow']
  removeRow: SshHostsCardActions['removeRow']
  save: SshHostsCardActions['save']
}

/**
 * Create the SSH hosts card controller over one settings scope.
 * @param scope - the bound settings scope for the `terminal-ssh` namespace,
 *   decoded with {@link decodeSshHostsDocument}.
 * @returns the controller's state store, actions, and slot-injection face.
 */
export function createSshHostsCardController(scope: SettingsScope<SshHostsDocument>): {
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
      // Replace, never mutate: published state is frozen outside production.
      hosts = hosts.map((row, i) => (i === index ? { ...row, ...patch } : row))
      publish({ hosts })
    },
    toggleRow: (index) => {
      if (hosts[index] === undefined || saving) return
      // The switch is an immediate apply: flip and write in one gesture, so
      // the registered backends track what the user sees without a save step.
      hosts = hosts.map((row, i) => (i === index ? { ...row, enabled: !row.enabled } : row))
      publish({ hosts })
      actions.save()
    },
    addRow: () => {
      hosts = [...hosts, { name: '', host: '', port: 22, username: 'root', identityFile: '', enabled: true }]
      publish({ hosts })
    },
    removeRow: (index) => {
      if (hosts[index] === undefined) return
      hosts = hosts.filter((_, i) => i !== index)
      publish({ hosts })
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
        toggleRow: actions.toggleRow,
        addRow: actions.addRow,
        removeRow: actions.removeRow,
        save: actions.save,
      }
    },
  }
}

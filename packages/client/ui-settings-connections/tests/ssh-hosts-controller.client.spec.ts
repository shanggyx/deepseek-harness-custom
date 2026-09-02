/** The SSH hosts controller: draft staging over one settings scope, and the save fence. */

import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  createSshHostsCardController,
  decodeSshHostsDocument,
  type SshHostRow,
  type SshHostsDocument,
} from '../src/client/ssh-hosts-card-controller.ts'

function fakeScope(
  served: { status: SettingsScopeSnapshot<SshHostsDocument>['status']; value: unknown; writable: boolean },
) {
  const listeners = new Set<() => void>()
  let snapshot: SettingsScopeSnapshot<SshHostsDocument> = {
    status: served.status,
    value: served.value as SshHostsDocument,
    base: undefined,
    user: undefined,
    revision: 0,
    writable: served.writable,
    mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: vi.fn((_field: string, value: unknown) => {
      snapshot = { ...snapshot, value: value as SshHostsDocument }
      return Promise.resolve()
    }),
    emit: () => { for (const listener of listeners) listener() },
  } as unknown as SettingsScope<SshHostsDocument> & {
    emit: () => void
    set: ReturnType<typeof vi.fn>
  }
}

const row: SshHostRow = {
  name: 'box', host: 'h', port: 22, username: 'root', identityFile: '', enabled: true,
}

describe('createSshHostsCardController', () => {
  it('adopts the served roster and the served/writable facts', () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    const { store } = createSshHostsCardController(scope)

    expect(store.getSnapshot()).toEqual({
      available: true,
      writable: true,
      saving: false,
      failed: false,
      hosts: [row],
    })
  })

  it('reports an unserved namespace as unavailable with an empty roster', () => {
    const scope = fakeScope({ status: 'unavailable', value: undefined, writable: false })
    const { store } = createSshHostsCardController(scope)

    expect(store.getSnapshot().available).toBe(false)
    expect(store.getSnapshot().hosts).toEqual([])
  })

  it('stages edits on copied rows and re-adopts a Host push', () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    const { store, actions } = createSshHostsCardController(scope)

    actions.editRow(0, { port: 2222 })
    expect(store.getSnapshot().hosts[0]).toEqual({ ...row, port: 2222 })
    expect(scope.getSnapshot().value).toEqual({ hosts: [row] })

    scope.emit()
    expect(store.getSnapshot().hosts).toEqual([row])
  })

  it('ignores edits and removals past the end of the draft', () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    const { store, actions } = createSshHostsCardController(scope)

    actions.editRow(3, { port: 1 })
    actions.removeRow(3)

    expect(store.getSnapshot().hosts).toEqual([row])
  })

  it('appends a blank enabled row and writes the whole roster on save', async () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [] }, writable: true })
    const { store, actions } = createSshHostsCardController(scope)

    actions.addRow()
    expect(store.getSnapshot().hosts).toEqual([
      { name: '', host: '', port: 22, username: 'root', identityFile: '', enabled: true },
    ])

    actions.save()
    await vi.waitFor(() => { expect(scope.set).toHaveBeenCalledWith('hosts', store.getSnapshot().hosts) })
    expect(store.getSnapshot().saving).toBe(false)
    expect(store.getSnapshot().failed).toBe(false)
  })

  it('flips the switch and writes the roster immediately', async () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    const { store, actions } = createSshHostsCardController(scope)

    actions.toggleRow(0)
    expect(store.getSnapshot().hosts[0]?.enabled).toBe(false)
    await vi.waitFor(() => { expect(scope.set).toHaveBeenCalled() })
  })

  it('keeps the switch inert while a save is in flight', () => {
    const set = vi.fn((_field: string, _value: unknown) => new Promise<void>(() => {}))
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    ;(scope as { set: unknown }).set = set
    const { store, actions } = createSshHostsCardController(scope)

    actions.save()
    actions.toggleRow(0)
    expect(store.getSnapshot().hosts[0]?.enabled).toBe(true)
    expect(set).toHaveBeenCalledTimes(1)
  })

  it('marks a rejected save and keeps the draft', async () => {
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    ;(scope as { set: ReturnType<typeof vi.fn> }).set.mockRejectedValueOnce(new Error('rejected'))
    const { store, actions } = createSshHostsCardController(scope)

    actions.save()
    await vi.waitFor(() => { expect(store.getSnapshot().failed).toBe(true) })

    expect(store.getSnapshot().saving).toBe(false)
    expect(store.getSnapshot().hosts).toEqual([row])
  })

  it('refuses a second save while one is in flight', () => {
    const set = vi.fn((_field: string, _value: unknown) => new Promise<void>(() => {}))
    const scope = fakeScope({ status: 'ready', value: { hosts: [row] }, writable: true })
    ;(scope as { set: unknown }).set = set
    const { store, actions } = createSshHostsCardController(scope)

    actions.save()
    expect(store.getSnapshot().saving).toBe(true)
    actions.save()
    expect(set).toHaveBeenCalledTimes(1)
  })
})

describe('decodeSshHostsDocument', () => {
  it('normalizes rows and fills a missing identity file and switch', () => {
    expect(decodeSshHostsDocument({
      hosts: [{ name: 'box', host: 'h', port: 2222, username: 'root' }],
    })).toEqual({
      hosts: [{ name: 'box', host: 'h', port: 2222, username: 'root', identityFile: '', enabled: true }],
    })
  })

  it('keeps an explicit disabled switch', () => {
    expect(decodeSshHostsDocument({
      hosts: [{ name: 'box', host: 'h', port: 22, username: 'root', enabled: false }],
    })).toEqual({
      hosts: [{ name: 'box', host: 'h', port: 22, username: 'root', identityFile: '', enabled: false }],
    })
  })

  it('accepts an absent roster and refuses malformed sections', () => {
    expect(decodeSshHostsDocument({})).toEqual({})
    expect(decodeSshHostsDocument(undefined)).toBeUndefined()
    expect(decodeSshHostsDocument([row])).toBeUndefined()
    expect(decodeSshHostsDocument({ hosts: 'all' })).toBeUndefined()
    expect(decodeSshHostsDocument({ hosts: [{ name: 3 }] })).toBeUndefined()
  })
})

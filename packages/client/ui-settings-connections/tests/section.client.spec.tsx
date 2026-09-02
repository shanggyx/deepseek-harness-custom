// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { ConnectionsSection } from '../src/client/ConnectionsSection.tsx'
import type { ConnectionsSectionProps } from '../src/client/ConnectionsSection.tsx'
import { endpointOf, SshHostsCard } from '../src/client/SshHostsCard.tsx'
import type { SshHostsCardProps } from '../src/client/SshHostsCard.tsx'
import type { SshHostRow, SshHostsCardState } from '../src/client/ssh-hosts-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

function row(rest: Partial<SshHostRow> = {}): SshHostRow {
  return {
    name: 'box', host: 'h', port: 22, username: 'root', identityFile: '', enabled: true,
    ...rest,
  }
}

function renderSection(state: Partial<SshHostsCardState> = {}, hosts: SshHostRow[] = [row()]) {
  const store = createSnapshotStore<SshHostsCardState>({
    available: true,
    writable: true,
    saving: false,
    failed: false,
    hosts,
    ...state,
  })
  const actions = {
    editRow: vi.fn(),
    toggleRow: vi.fn(),
    addRow: vi.fn(),
    removeRow: vi.fn(),
    save: vi.fn(),
  }
  const props = {
    ...actions,
    t,
    useSshHosts: bindSnapshotSelector(store),
  } as unknown as ConnectionsSectionProps
  render(<ConnectionsSection {...props} />)
  return { actions, store }
}

describe('ConnectionsSection', () => {
  it('leads with its heading and intro', () => {
    renderSection()

    expect(screen.getByRole('heading', { name: en.title })).toBeTruthy()
    expect(screen.getByText(en.intro)).toBeTruthy()
  })

  it('says so when the deployment composes no SSH terminal', () => {
    renderSection({ available: false }, [])

    expect(screen.getByText(en.unavailable)).toBeTruthy()
    expect(screen.queryByText(en.sshTitle)).toBeNull()
  })

  it('renders one toggleable card per host with its endpoint line', () => {
    renderSection({}, [row({ name: 'a', host: '10.0.0.4', port: 2222 })])

    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('root@10.0.0.4:2222')).toBeTruthy()
    expect(screen.getByRole('switch', { name: `${en.sshName} a` }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(en.sshEnabled)).toBeTruthy()
  })

  it('marks a toggled-off host and flips it with an immediate write', () => {
    const { actions } = renderSection({}, [row({ enabled: false })])

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(en.sshDisabled)).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))

    expect(actions.toggleRow).toHaveBeenCalledOnce()
  })

  it('keeps the roster fields collapsed until the edit control expands them', () => {
    renderSection()

    expect(screen.queryByLabelText(en.sshHost)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: en.sshEdit }))

    expect(screen.getByLabelText(en.sshHost)).toBeTruthy()
    expect(screen.getByLabelText(en.sshIdentity)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: en.sshEdit }))
    expect(screen.queryByLabelText(en.sshHost)).toBeNull()
  })

  it('adds a blank host from the header action and stages its fields', () => {
    const { actions } = renderSection({}, [])

    fireEvent.click(screen.getByRole('button', { name: en.sshAdd }))

    expect(actions.addRow).toHaveBeenCalledOnce()
  })

  it('stages edits without writing, and writes only on save', () => {
    const { actions } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: en.sshEdit }))

    fireEvent.change(screen.getByLabelText(en.sshHost), { target: { value: 'seetacloud' } })
    fireEvent.change(screen.getByLabelText(en.sshPort), { target: { value: '41222' } })
    fireEvent.click(screen.getByRole('button', { name: en.sshRemove }))
    fireEvent.click(screen.getByRole('button', { name: en.sshSave }))

    expect(actions.editRow.mock.calls).toEqual([
      [0, { host: 'seetacloud' }],
      [0, { port: 41222 }],
    ])
    expect(actions.removeRow).toHaveBeenCalledWith(0)
    expect(actions.save).toHaveBeenCalledOnce()
  })

  it('reports a save the deployment did not accept', () => {
    renderSection({ failed: true })

    expect(screen.getByText(en.sshSaveFailed)).toBeTruthy()
  })

  it('disables every control while the document is read-only', () => {
    renderSection({ writable: false })

    expect(screen.getByRole('switch')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.sshAdd })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.sshSave })).toHaveProperty('disabled', true)
  })
})

describe('endpointOf', () => {
  it('joins user, host, and port on one line', () => {
    expect(endpointOf(row({ username: 'root', host: 'connect.x.com', port: 26704 })))
      .toBe('root@connect.x.com:26704')
  })
})

describe('SshHostsCard switch contract', () => {
  it('exposes each switch by its host name for assistive names', () => {
    const state: SshHostsCardState = {
      available: true, writable: true, saving: false, failed: false,
      hosts: [row({ name: 'seetacloud' }), row({ name: 'lab', enabled: false })],
    }
    const props = {
      t,
      state,
      actions: { editRow: vi.fn(), toggleRow: vi.fn(), addRow: vi.fn(), removeRow: vi.fn(), save: vi.fn() },
    } as unknown as SshHostsCardProps
    render(<SshHostsCard {...props} />)

    expect(screen.getByRole('switch', { name: `${en.sshName} seetacloud` }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: `${en.sshName} lab` }).getAttribute('aria-checked')).toBe('false')
  })
})

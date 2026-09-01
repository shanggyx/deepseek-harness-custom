// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { ConnectionsSection } from '../src/client/ConnectionsSection.tsx'
import type { ConnectionsSectionProps } from '../src/client/ConnectionsSection.tsx'
import type { SshHostRow, SshHostsCardState } from '../src/client/ssh-hosts-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

function row(rest: Partial<SshHostRow> = {}): SshHostRow {
  return { name: 'box', host: 'h', port: 22, username: 'root', identityFile: '', ...rest }
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
  const actions = { editRow: vi.fn(), addRow: vi.fn(), removeRow: vi.fn(), save: vi.fn() }
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

  it('renders one labeled input group per host row', () => {
    renderSection({}, [row({ name: 'a' }), row({ name: 'b' })])

    expect(screen.getAllByLabelText(en.sshName).map(input => (input as HTMLInputElement).value))
      .toEqual(['a', 'b'])
  })

  it('stages row edits, additions, and removals without writing', () => {
    const { actions } = renderSection()

    fireEvent.change(screen.getByLabelText(en.sshName), { target: { value: 'seetacloud' } })
    fireEvent.change(screen.getByLabelText(en.sshPort), { target: { value: '41222' } })
    fireEvent.click(screen.getByRole('button', { name: en.sshRemove }))
    fireEvent.click(screen.getByRole('button', { name: en.sshAdd }))

    expect(actions.editRow.mock.calls).toEqual([
      [0, { name: 'seetacloud' }],
      [0, { port: 41222 }],
    ])
    expect(actions.removeRow).toHaveBeenCalledWith(0)
    expect(actions.addRow).toHaveBeenCalledOnce()
    expect(actions.save).not.toHaveBeenCalled()
  })

  it('writes the draft roster only on save', () => {
    const { actions } = renderSection()

    fireEvent.click(screen.getByRole('button', { name: en.sshSave }))

    expect(actions.save).toHaveBeenCalledOnce()
  })

  it('reports a save the deployment did not accept', () => {
    renderSection({ failed: true })

    expect(screen.getByText(en.sshSaveFailed)).toBeTruthy()
  })

  it('disables every control while the document is read-only', () => {
    renderSection({ writable: false })

    expect(screen.getByLabelText(en.sshName)).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.sshAdd })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.sshSave })).toHaveProperty('disabled', true)
  })
})

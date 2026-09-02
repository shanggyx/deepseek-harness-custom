/** What the browser half registers, and that it all leaves with the fiber. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-settings-connections/client'
import type { SshHostsCardInjected } from '../src/client/ssh-hosts-card-controller.ts'

// These specs assert the shipped Chinese copy. The lane has no jsdom `window`,
// so browser-language detection never runs and a fresh LocaleRuntime opens on
// FALLBACK_LOCALE (en); bench stages zh explicitly on the locale instead.

/**
 * @param served - namespaces the Host describes; omitted answers a failed read,
 * which is what the unavailable-section spec wants.
 * @param hosts - the roster the Host answers with for a served `terminal-ssh`.
 */
async function bench(served?: string[], hosts: Array<Record<string, unknown>> = []) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const describeSettings = vi.fn(() => Promise.resolve(served === undefined
    ? { ok: false as const, error: { code: 'internal', message: 'no provider', details: {} } }
    : {
      ok: true as const,
      value: {
        writable: true,
        hasDocument: true,
        namespaces: served.map(ns => ({
          ns,
          schema: {},
          value: ns === 'terminal-ssh' ? { hosts } : {},
          applies: 'live',
          secrets: [],
          revision: 0,
        })),
      },
    }))
  const remote = new TestRemote(ctx, {
    settings: { describe: describeSettings },
  })
  ctx.provide('connection', {
    isLoopback: true,
  } as never)
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, describeSettings, remote }
}

function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

/** Read the section's injected face. */
function sectionFace(slots: SlotRegistry): SshHostsCardInjected {
  const entry = slots.entries('settings.section')[0]!
  return (entry.inject as unknown as () => SshHostsCardInjected)()
}

describe('ui-settings-connections apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope'])
  })

  it('registers the Connections section between Models and Plugins', async () => {
    const { ctx, slots } = await bench(['terminal-ssh'])
    declareRoot(slots)

    await ctx.plugin({ inject: [...inject], apply }).await()

    const section = slots.entries('settings.section')[0]!
    expect(section.options).toMatchObject({ id: 'connections', order: 12 })
    // The nav label is a locale-following thunk; owners resolve it at read time.
    expect(resolveSlotLabel(section.options.label)).toBe('连接')
  })

  it('injects the card face its section consumes, adopting the served roster', async () => {
    const { ctx, slots } = await bench(['terminal-ssh'], [
      { name: 'seetacloud', host: 'ssh.example', port: 22, username: 'root', identityFile: '' },
    ])
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()

    const face = sectionFace(slots)

    expect(Object.keys(face.hooks)).toEqual(['sshHosts'])
    expect(typeof face.editRow).toBe('function')
    expect(typeof face.addRow).toBe('function')
    expect(typeof face.removeRow).toBe('function')
    expect(typeof face.save).toBe('function')
    // The store adopts the served roster: the section opens on real rows.
    expect(face.hooks.sshHosts.getSnapshot().hosts).toEqual([
      {
        name: 'seetacloud', host: 'ssh.example', port: 22, username: 'root',
        identityFile: '', enabled: true,
      },
    ])
    expect(face.hooks.sshHosts.getSnapshot().available).toBe(true)
  })

  it('marks the card unavailable when the namespace is not served', async () => {
    // The Host answered, and `terminal-ssh` is not among the served namespaces;
    // an unanswered read would be mere loading, not unavailability.
    const { ctx, slots } = await bench([])
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()

    expect(sectionFace(slots).hooks.sshHosts.getSnapshot().available).toBe(false)
  })

  it('collapses every contribution on teardown', async () => {
    const { ctx, slots } = await bench(['terminal-ssh'])
    declareRoot(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('settings.section')).toHaveLength(1)

    await fiber.dispose()

    expect(slots.entries('settings.section')).toHaveLength(0)
  })
})

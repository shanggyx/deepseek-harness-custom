import { describe, expect, it } from 'vitest'
import { resolveHosts, sshArgv } from '../src/index.ts'
import { Config } from '../src/config.ts'

describe('terminal-ssh config', () => {
  it('resolves host defaults and validates the roster', () => {
    const hosts = resolveHosts({
      hosts: [
        { name: 'gpu', host: 'connect.nma1.seetacloud.com', port: 26704, username: 'root' },
        { name: 'home', host: '192.168.1.20', port: 22, username: 'user', identityFile: '~/.ssh/id_rsa' },
      ],
    })
    expect(hosts[0]).toEqual({
      name: 'gpu', host: 'connect.nma1.seetacloud.com', port: 26704, username: 'root',
    })
    expect(hosts[1]).toEqual({
      name: 'home', host: '192.168.1.20', port: 22, username: 'user', identityFile: '~/.ssh/id_rsa',
    })
  })

  it('rejects duplicate names and empty fields', () => {
    const one = { name: 'gpu', host: 'h', port: 22, username: 'root' }
    expect(() => resolveHosts({ hosts: [one, { ...one }] })).toThrow('duplicate host name')
    expect(() => resolveHosts({ hosts: [{ ...one, name: '' }] })).toThrow('name must be non-empty')
    expect(() => resolveHosts({ hosts: [{ ...one, host: '' }] })).toThrow('host must be non-empty')
    expect(() => resolveHosts({ hosts: [{ ...one, username: '' }] })).toThrow('username must be non-empty')
    expect(() => resolveHosts({ hosts: [{ ...one, port: 0 }] })).toThrow('port must be a positive port number')
  })
})

describe('sshArgv', () => {
  it('composes the login argv with the port and accept-new host keys', () => {
    expect(sshArgv({ name: 'gpu', host: 'example.com', port: 26704, username: 'root' })).toEqual([
      'ssh', '-p', '26704', '-o', 'StrictHostKeyChecking=accept-new', 'root@example.com',
    ])
  })

  it('pins an explicit identity to IdentitiesOnly', () => {
    expect(sshArgv({ name: 'gpu', host: 'example.com', port: 22, username: 'root', identityFile: '~/.ssh/id_rsa' })).toEqual([
      'ssh', '-p', '22', '-i', '~/.ssh/id_rsa', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=accept-new', 'root@example.com',
    ])
  })
})

describe('Config schema', () => {
  it('defaults to no hosts and the terminal-bash tuning defaults', () => {
    const resolved = Config({})
    expect(resolved.hosts).toEqual([])
    expect(resolved.rows).toBe(40)
    expect(resolved.timeoutMs).toBe(30_000)
  })
})

---
description: "SSH PTY backend: persistent remote shell sessions over the local ssh client, one registered backend per configured host, user-managed through the `terminal-ssh` settings section."
kind: "package-reference"
---

# @deepseek-ai/dsh-terminal-ssh

English | [中文](README.zh.md)

## Summary

`dsh-terminal-ssh` registers one `ctx.terminals` backend per configured SSH host: opening `ssh:<name>` spawns the local `ssh` client against that host and wraps it in the same persistent `LocalPtySession` machinery the local shell backend uses. Sessions are interactive by design — the remote banner, password prompts, and the remote shell are all driven by the owner's sends, so password-authenticated hosts work without storing secrets. Hosts merge by name from the plugin configuration and the user-managed `terminal-ssh` settings section (settings wins), and settings changes re-register the affected backends in place.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The base bundle mounts this backend for every profile, so `dsh web`, the desktop shell, and the CLI profiles all serve SSH sessions without extra composition; agent presets mount only the terminal tools. The terminal Consumer opens `ssh:<name>` exactly like a local `shell` session; every send, readiness, and close behavior is the shared PTY contract.

### Hosts

A host carries `name`, `host`, `port` (default 22), `username`, an optional `identityFile`, and an optional `enabled` switch (absent means enabled). Two layers merge by name, the settings section winning: the plugin `config.hosts` (what a deployment ships) and the user's `terminal-ssh` settings document (what the Connections settings page edits). A disabled host stays configured but registers no backend, so `ssh:<name>` is not openable until it is switched back on. Renaming a host replaces its backend under the new type; removing one unregisters it. A duplicate name across layers is one backend — the user layer's value.

### Remote workspaces

Every enabled host also anchors a remote workspace: a real local directory that the workspace registry, sandbox, and persistence treat as an ordinary workspace. The anchor root defaults to this user's OS temp directory (`dsh-remote-workspaces/<name>`), deliberately outside the profile home, and moves to any location via the plugin's `remoteWorkspaceRoot` config. Creating a Workspace with `workspace.create { sshHost: <name> }` (the Connections roster feeds the picker) provisions the anchor and registers the workspace; sessions created in it receive a `ssh:workspace` runtime-context clause — logged with the runtime-context snapshot like any prompt clause — directing the agent to work on the remote host (its login home directory) through the `ssh:<name>` terminal instead of the local file tools. The anchor itself stays empty: no project data is stored locally.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `hosts` | `[]` | Composition-shipped host roster; each entry registers one `ssh:<name>` backend |

Session tuning (`rows`, `cols`, scrollback bounds, readiness timings, `timeoutMs`, `disposeGraceMs`) mirrors terminal-bash and applies to every SSH session; the generated [configuration catalog](../../../docs/config-catalog.md) is the exhaustive source for every field.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The backend composes `ssh` argv per host — port, optional explicit identity with `IdentitiesOnly=yes`, `StrictHostKeyChecking=accept-new`, then `user@host` — and spawns it through the subprocess terminal primitive, reusing `LocalPtySession` from `dsh-terminal-bash` unchanged. There is no startup handshake or private prompt marker: the remote side is outside this process's control, so every send settles through the shared silence/timeout tiers, and the echoed remote banner is startup output, never a readiness proof. A settings-scope subscription over the `terminal-ssh` namespace diffs the served roster against the registered backends and re-registers only the changed names.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Terminal subsystem reference](../../../docs/subsystems/terminal.md) — the service contract this backend implements.
- [terminal-bash](../terminal-bash/README.md) — the local backend whose session machinery and readiness model this package reuses.
- [tool-terminal tools](../tool-terminal/README.md) — the model-facing tools that operate sessions.

-----

<a id="model-experience"></a>
## Model Experience

### Indirect consumer

#### What the model sees

This package registers no prompt or tool. Through `@deepseek-ai/dsh-tool-terminal` or another PTY consumer, the model may receive bounded remote startup output, send deltas, scrollback pages, readiness reasons, and cleanup errors — including ssh's own authentication prompts.

#### Token effect

Retained PTY scrollback is not placed in model history until a consumer returns bounded output.

#### KV Cache effect

No direct invalidation; consumer results remain append-only.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The local sandbox does not reach the remote host** — commands run on the SSH host execute outside every local sandbox mode; composition should treat the backend as a trust decision about the configured hosts.
- **No port forwarding or SCP** — the backend opens interactive shell sessions only; file transfer and tunnels stay out of scope.
- **Host-key trust is `accept-new`** — first connections trust the presented key; a changed host key later fails the connection rather than prompting.
- **Readiness is heuristic** — without a controlled remote prompt, sends settle through silence and timeout tiers only.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

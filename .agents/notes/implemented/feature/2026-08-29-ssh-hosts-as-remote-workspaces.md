# Agent Note: SSH hosts as remote workspaces

Status: implemented

English | [中文](2026-08-29-ssh-hosts-as-remote-workspaces.zh.md)

## Problem

The Connections page managed SSH hosts, but the workspace surface ignored them: creating a session offered only local folders, so "I have SSH" never became "I work on that host." A session cannot actually run *in* a remote directory — the workspace registry canonicalizes and `stat`s the path, the sandbox resolves its writable root from the session cwd, fs tools enforce local paths, and session logs are keyed by local cwd — so a literal remote path would fail at creation or, worse, create a session that silently worked on the wrong machine.

## Decision

A remote workspace is a **local anchor directory plus a model-visible clause**. Every enabled host owns an anchor — a real local directory (by default `dsh-remote-workspaces/<name>` under the OS temp directory, relocatable via the plugin `remoteWorkspaceRoot` config), so every local invariant keeps holding. `workspace.create` accepts `{ sshHost: <name> }` alongside `{ path }` (exactly one required): the workspace controller resolves the name through the `sshWorkspace` service terminal-ssh provides, which provisions the anchor and returns its path; the workspace, session cwd, sandbox root, and persistence key are then ordinary local facts. What makes the session *remote* is the `ssh:workspace` prompt context terminal-ssh registers: a clause that matches the session cwd against the roster's anchors and directs the agent to work through `terminal_open` type `ssh:<name>` — logged with the runtime-context snapshot on the first assembled request, satisfying model-visible ⟺ logged without new event types. The picker menu lists the served roster's enabled hosts (globe icon) above the add entry; choosing one creates the anchored workspace and starts the session.

### Ownership

terminal-ssh owns the anchor convention, the roster projection, and the clause — the SSH capability's facts stay with the SSH package. The workspace controller depends on it type-only plus a project reference and fails loud (`ssh-workspace-unavailable`) when the deployment composes no SSH backend. ui-workspace reads the same `terminal-ssh` settings namespace client-side and spells the small projection itself — a client package must not value-import a Host package, and the served roster is three fields.

## Alternatives considered

- **A `ssh:` URI as the workspace path**: rejected — every consumer (realpath, sandbox, persistence keying, session reuse by cwd equality) assumes a local canonical directory; threading a URI through all of them is a remote-fs project, not a workspace feature.
- **Compose-side only** (mount each host as a preset persona): per-host compositions multiply, and the clause would say nothing for hosts added at runtime through the GUI.
- **Skipping the clause**: the workspace would be a useless empty local directory the agent tries to fill; the clause is the feature's teeth.

## Consequences

Picking a host in the workspace picker yields a session whose sidebar label is the host name and whose first request already says "work on the remote host through its terminal." Local fs tools remain local-only; file transfer between the machines stays out of scope (no SCP). The anchor directories are empty by design and safe to delete when the roster entry goes away.

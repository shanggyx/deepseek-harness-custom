---
description: "Connections settings section for the dsh web client: the user-owned SSH remote-host roster the agent's terminal tools reach."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-connections

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-settings-connections` is the Connections settings page of the dsh web client: it renders the user-managed SSH remote-host roster as editable rows (name, host, port, user, identity file) over the `terminal-ssh` settings namespace. Rows stage in a draft and write to the Host document only on save; a deployment that composes no `terminal-ssh` plugin renders an unavailable note instead of a dead form.

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

Open the Connections section in the Settings navigation (the globe entry) to manage the hosts the agent reaches through persistent terminal sessions. Each host renders as one card — an enable switch, the host's name over its `user@host:port` line, an enabled/disabled marker, and an edit control that expands the five fields. The switch applies immediately; field edits stage until **Save** replaces the roster as one document mutation. Controls disable while the deployment stores settings read-only, and a rejected save keeps the draft on screen with a failure notice.

A toggled-off host stays configured but registers no backend, so `ssh:<name>` is not openable until it is switched back on. The roster this page edits is the user layer only: hosts composed by a preset or deployment bundle live in a different settings layer and are not shown or overwritten here.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The section registers one `settings.section` entry (`id: connections`, `order: 12`) with the settings shell, and binds the `terminal-ssh` namespace through the shared settings scope. The controller adopts the served roster into a snapshot store, stages edits on copied rows, and writes the whole roster as one `hosts` set op; a Host push re-adopts the served value over any un-saved draft. The card is a pure presentational component over `{t, state, actions}`; the section owns the slot wiring and the unavailable gate.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-settings](../ui-settings/README.md) — the domain base whose scope service this page builds on.
- [terminal-ssh](../../terminal/terminal-ssh/README.md) — the Host plugin that owns the `terminal-ssh` namespace and serves the SSH terminal backends.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI plugin layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The roster is the whole editable surface** — per-host options beyond the five row fields (jump hosts, keep-alive intervals, agent forwarding) stay in `settings.yaml`.
- **No connection test** — the page stages and stores configuration only; reachability is what the agent's terminal sessions observe.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

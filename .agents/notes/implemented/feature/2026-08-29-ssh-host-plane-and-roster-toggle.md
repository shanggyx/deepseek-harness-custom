# Agent Note: SSH terminal stack on the host plane and the toggleable roster

Status: implemented

English | [中文](2026-08-29-ssh-host-plane-and-roster-toggle.zh.md)

## Problem

`terminal-ssh` shipped mounted inside the `standard` agent preset, and that shortcut failed in three stacked ways. The preset mount is lazy — the standing mount exists only after the first session composes that preset — so `settings.describe` listed no `terminal-ssh` namespace at boot and the Connections page reported "not enabled" on a healthy deployment. The preset row carried a real server (host, port, user) hardcoded in a shipped composition file, which is user data in the repository. And the top-level service rows sat outside the `isolate` group the preset file's own header mandates. Separately, the roster UI rendered five bare input rows per host, nothing like the one-line-per-host switch card the user asked for, and the desktop menu dropdown consumed `--dsw-alias-bg-base`, which the image-background mode rebinds to a translucent color — so open menus showed the page through themselves.

## Decision

The terminal stack moves to the host plane, and the roster gains a real switch.

### Composition

`terminals` (`@deepseek-ai/dsh-terminal`) and `terminal-ssh` mount as rows in the **base bundle**, next to `subprocess-local`: every profile that includes base (web, desktop, headless, acp, sdk-app) registers the service and the SSH backends at boot, so the settings namespace exists before any session and the Connections page is never "not enabled" by lazy mounting. `sdk-minimal` does not include base and keeps its own `pty` row, so there is no second provider. The `standard` preset sheds both rows — including the hardcoded host — and keeps only `tool-terminal`, matching the file's own rule that registries are host-plane and presets choose tools.

### The enabled switch

`SshHostConfig` gains `enabled?: boolean` (absent = enabled), carried through `resolveHosts`, the settings schema, and the client decoder. Backend registration filters on it in both the boot path and the settings-driven rebind, so a toggled-off host keeps its configuration but `ssh:<name>` is not openable. The client switch is an immediate apply: flipping it writes the whole roster in one gesture, because a connection switch that needs a separate Save is not a switch. Field edits still stage until 保存.

### The roster UI

Each host renders as one card: switch, name over its `user@host:port` line, an enabled/disabled dot marker, and an edit control that expands the five fields in a grid — the shape the user pointed at, not a spreadsheet of inputs. The add action moved to the header row.

### The dropdown surface

The desktop menu dropdown now paints `--dsw-alias-bg-layer-2` (the settings panel's opaque surface) instead of `bg-base`, which the image-background mode deliberately rebinds to a translucent color-mix; a menu must cover the page behind it.

## Alternatives considered

- **Keep the mount in the preset and force an early mount**: papers over the lazy-namespace symptom while leaving user data in a shipped file and the realm violation in place.
- **Web-app bundle instead of base**: covers only the browser profile; headless would silently lose the terminal tools the standard preset promises.
- **A real connectivity probe for the status dot**: honest, but it needs a new Remote namespace and a probe lifetime; the enabled/disabled marker states exactly what the harness knows (backend registered or not) without pretending to know reachability.

## Consequences

Every profile boots with the terminal service and the SSH backends; the Connections page lists the served roster on first open, and the user's server now lives only in their settings document. The preset tree carries one less host-plane violation, and the shipped composition no longer contains anyone's server. The cost: base-bundle inclusion is a product decision now — removing SSH from a deployment means an explicit patch row, not dropping a preset.

# Agent Note: Connections settings section for SSH hosts

Status: implemented

English | [中文](2026-08-29-connections-settings-section.zh.md)

## Problem

The user-managed SSH host roster shipped as one more expandable card inside the Plugins section's configurable tab. That placement failed twice over. Discoverability: a roster of remote machines is not "a plugin's configuration" in any user's mental model, and the card sat four folds deep behind a generic tab. Mechanics: the configurable tab dispatches cards by served namespace and hides unserved ones, so the roster rendered only when `terminal-ssh` happened to be composed — and the card itself carried a latent defect (it mutated a snapshot-store-published array in place, which the store freezes outside production, so the second interaction threw) that no test caught because the card's module import crashed the whole package's test file before any assertion ran.

## Decision

SSH hosts get their own settings section: `packages/client/ui-settings-connections` (`@deepseek-ai/dsh-client-ui-settings-connections`) registers one `settings.section` entry (`id: connections`, `order: 12`, between Models and Plugins), rendered with the meridian-globe nav glyph in the settings shell's `navIcon`. The card moved out of `ui-settings-connections`' sibling — deleted from `ui-settings-plugins`, which returns to exactly the four host-plane plugin cards its tests and README already described — and the roster controller moved with it.

### Structure

The section unwraps one injected face (`SshHostsCardInjected`) and renders a presentational card that takes `{t, state, actions}` — no slot machinery of its own, because no external plugin contributes connection cards today; the item-slot indirection waits for a second connection kind. The section gates on the scope snapshot's status: a served namespace renders the card, an answered-but-unserved namespace renders the unavailable note, and an in-flight read renders the empty card briefly rather than flashing a wrong answer.

### Namespace decoding

The scope binds with a domain-owned `decodeSshHostsDocument` instead of the default wire-schema validation: the client cannot depend on the Host package that owns the schemastery envelope, and the roster's shape (`{hosts?: SshHostRow[]}`) is five fields this package already names. The decoder normalizes rows (absent `identityFile` becomes `''`) and rejects anything else, so a malformed section never reaches the card.

## Alternatives considered

- **Keep the card in the Plugins tab**: no new package, but the discoverability problem is the actual complaint, and "connections" will grow non-SSH entries (the section heading and intro are already roster-agnostic).
- **A `settings.connection.item` child slot from day one**: mirrors the General section's extensibility, but with one shipped card it is machinery without a second contributor — the repository's speculative-extension smell.
- **Fix the card in place, move later**: leaves the user-facing complaint untouched and keeps a plugin-config tab hosting a non-plugin surface.

## Consequences

The Plugins page sheds its one non-plugin card; the Connections page owns the roster, its copy dictionary (`settings.connections`), and its future. The freeze-defect fix (actions rebuild the roster array instead of mutating) is covered by controller specs that actually run, and the new package's apply specs pin the section id, order, localized nav label, and teardown. The package joins the web-app roster row, the client tsconfig aggregate, the generated catalogs, and the client README table; `terminal-ssh` gained the package README its earlier introduction skipped, which the readme gate had been failing since.

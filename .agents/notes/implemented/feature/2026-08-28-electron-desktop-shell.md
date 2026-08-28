# Agent Note: Electron desktop shell

Status: implemented

English | [中文](2026-08-28-electron-desktop-shell.zh.md)

## Problem

dsh's interactive surface is the browser UI: `dsh web` serves the React app on 127.0.0.1, and the user opens it in a browser tab. That shape has no desktop presence — no taskbar identity, no remembered window, no application lifecycle — so the product reads as "a website" rather than the agent's own application. The deleted terminal TUI once owned that app feel; its removal left no non-browser window story at all.

Reintroducing a window must not resurrect a second UI stack: the web surface owns the conversation, settings, and theme systems, and a parallel renderer would fork every one of them.

## Decision

`apps/desktop` (`@deepseek-ai/dsh-desktop`) is an Electron shell over the existing web surface. The main process spawns `dsh web --port 0` as a child process, parses the readiness URL line the web runtime already prints for supervisors (`dsh web: http://…` in [`packages/bundle/web-app/src/index.ts`](../../../../packages/bundle/web-app/src/index.ts)), and loads that URL in a `BrowserWindow`. The shell adds no plugin rows, no transport, and no UI code: everything user-visible remains web-surface behavior, and the webserver header comment's Electron-compatibility expectation is realized by the plain localhost shape.

### Launch and lifecycle

The default launch runs the repository from source (`node --import tsx/esm apps/cli/src/bin.ts web --port 0` from the checkout root), the same entry the root `pnpm dsh` script uses; `DSH_DESKTOP_NODE` and `DSH_DESKTOP_ENTRY` re-target both halves for a future packaged shell. `--port 0` makes the OS pick a free port, so the shell never races the composed default. Closing the window kills the child's whole process tree (`taskkill /T /F` on Windows, SIGTERM on the direct child elsewhere); a child that exits on its own shows an error dialog and closes the shell. A second launch cannot take the single-instance lock and focuses the first window instead of spawning a second dsh runtime.

### Window behavior

Window geometry persists to `window-bounds.json` under Electron's userData directory and is re-validated against the current display on load: a size below the three-column minimum or a position off every display falls back to defaults. Resize adaptation itself needs no new code — the web layout's `ResizeObserver` and column solver already track the viewport — so the shell adds only `minWidth`/`minHeight` and the stock zoom menu roles. The window stays hidden until first paint, which with the page's boot-theme script removes any background flash; the shell's own `backgroundColor` only pairs with the light base token for the pre-paint gap and resize gutters.

### Windows app registration

`scripts/install-app.ts` makes the shell reachable like an installed program: it creates a Start Menu and a desktop shortcut named `dsh`, each pointing at the checkout's `electron.exe` with the app directory as the single argument, the shipped `assets/dsh.ico` (the favicon whale on a brand-gradient tile) as the icon, and the same icon on the BrowserWindow. The shortcuts live in the user's own Programs and Desktop folders, so `Get-StartApps`, start-menu search (Win+S), and the desktop icon all surface the app without an installer or admin rights; `--remove` deletes them. The registration points into the checkout and is re-created by `pnpm run desktop:install` after the artifacts rebuild.

### Shell surface: browser handoff, menu bar, and brand

The child runs with `--no-open`, so the web runtime's default-browser handoff stays off and the served page appears only inside the window; the 文件 menu's 在浏览器中打开 hands the current URL to the OS browser on demand. The menu bar models the editor-standard 文件/编辑/选择/查看/窗口/帮助 set: sidebar commands (新建会话, 打开设置, 切换侧栏) drive the served UI's own controls through CSS-module stem matching, so their behavior cannot drift from the page, while zoom maps from the physical key (`=`, `+`, numpad add) in `before-input-event` — Electron's built-in zoomIn role binds only `Plus`, which a plain `Ctrl++` never produces. The product name is data, not code: the sidebar brand and the window title both fall back to the `brand.localBuild` locale strings, so a deployment renames the shell by editing the locale, and the sidebar tests pin that copy.

### Repository integration

The app is a release member like `apps/cli` (publishable manifest, `files` policy added to the workspace-constraint gate), joins the host TypeScript face and the root tsdown workspace with a package-local bundle config, and ships no renderer preload: sandboxed preloads are CJS-only, so an ESM-shell stub preload would be a crash, not a placeholder. `electron` is a devDependency of this app alone; no other workspace imports it, and the coverage gate stays packages-scoped.

## Alternatives considered

- **Browser app mode** (`chrome`/`edge --app=<url>` via a `dsh web --open` flag): zero new dependencies, but the window stays the browser's — no process ownership (the server outlives the window arbitrarily), no single-instance lock, no theme-aware titlebar, and the result differs per installed browser. Kept as a manual workaround, not the product path.
- **Tauri**: small artifacts and the system WebView, but it introduces a Rust toolchain into a pure-Node repository with a second packaging story; rejected on maintenance cost.
- **Electron over `file://` with an IPC fetch bridge** (the deeper shape the webserver header comment anticipates): removes the localhost server but forks the transport — every Connection RPC, WebSocket downlink, and trust-fence decision would need an IPC twin. Deferred until a packaged product needs it; the localhost shape reuses the browser wire unchanged.
- **Booting the harness in-process inside the Electron main**: one process fewer, but it couples Electron's lifecycle to the Loader tree and forfeits the process isolation between UI and agent runtimes — a hung agent freezes the window. The child-process shape keeps the documented supervisor seam (`printUrl`) as the only contract between the halves.

## Consequences

The web UI gained a desktop home without a line of product code moving: theme, settings, conversation, and the `pnpm run dev:web` hot-reload loop behave identically in the window and in a browser tab. The cost is the Electron dependency (about 100 MB installed, one major-version churn per release train) now paid by every `pnpm install`, and the shell stays checkout-bound until the packaging work bundles a runtime and the web dist.

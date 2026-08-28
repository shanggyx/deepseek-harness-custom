# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

dsh Desktop is the Electron shell that opens the dsh browser UI in a local desktop window. The main process spawns the same `dsh web` profile the browser workflow uses, waits for the readiness URL line the web runtime prints, and loads the served page in a `BrowserWindow`. The shell owns no agent logic and adds no transport; every user-visible behavior stays web-surface behavior ([`src/main.ts`](src/main.ts)).

## Quick start

From the repository root:

```sh
pnpm run desktop
```

The script builds the web frontend, bundles `lib/main.js`, and launches Electron. The default launch runs from source and requires the repository checkout.

## Behavior

| Aspect | Contract |
|---|---|
| Port | The child runs `dsh web --port 0`; the OS picks a free port and the shell reads it from the readiness line. |
| Single instance | A second launch focuses the first window instead of spawning a second dsh runtime. |
| Process tree | Closing the window or quitting kills the child's whole process tree (`taskkill /T /F` on Windows). |
| Child exit | A dsh process that exits on its own shows an error dialog and closes the shell. |
| Window geometry | Size and position persist to `window-bounds.json` under Electron's userData directory, re-validated against the current display on load. |
| Resize | The three-column web layout already adapts to the viewport; the window adds only `minWidth`/`minHeight`. |
| Zoom | The stock View menu roles provide reset/in/out zoom and developer tools. |

## Environment overrides

| Variable | Purpose |
|---|---|
| `DSH_DESKTOP_NODE` | The Node executable that launches dsh (default: `node` on `PATH`). |
| `DSH_DESKTOP_ENTRY` | The dsh launcher module (default: `apps/cli/src/bin.ts`, the `pnpm dsh` source entry). |

## Background color

The window's own background pairs with the web UI's light `bg-base` token and is only visible before first paint, because the window stays hidden until the page is ready; the page applies the user's theme at load. Changing the UI's own colors happens in the theme system, not here: the palette and semantic tokens live in [`packages/client/ui-theme/src/styles/design-platform.css`](../../packages/client/ui-theme/src/styles/design-platform.css), and runtime themes register through `ThemeRuntime` in [`packages/client/ui-theme/src/client/index.ts`](../../packages/client/ui-theme/src/client/index.ts).

## Limitations

- The shell drives a repository checkout; the packaged distribution (bundled Node runtime, `lib/`, and the web dist) is deferred.
- No renderer preload exists yet: one lands with the first native bridge (sandboxed preloads are CJS-only, so it is not a free stub).

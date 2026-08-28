# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

dsh Desktop is the Electron shell that opens the dsh browser UI in a local desktop window. The main process spawns the same `dsh web` profile the browser workflow uses, waits for the readiness URL line the web runtime prints, and loads the served page in a `BrowserWindow`. The shell owns no agent logic and adds no transport; every user-visible behavior stays web-surface behavior ([`src/main.ts`](src/main.ts)).

## Where to launch from

Both commands below run from the **repository root** — the directory you cloned (the one holding the root `package.json`); every path in the shell resolves against that checkout. Prerequisites: Node ^22.19 or >=24 and pnpm (`corepack enable` or `npm i -g pnpm`), then `pnpm install` once in the repository root.

| You want | Command (repository root) | What happens |
|---|---|---|
| A dev run | `pnpm run desktop` | Builds the web frontend and the shell bundle, then opens the window. Closing the window exits everything. |
| An installed app | `pnpm run desktop:install` | Same builds, then registers **dsh** as a Windows app (see below). One-time; re-run after pulling changes. |
| Uninstall | `pnpm run desktop:uninstall` | Removes both shortcuts. Nothing else was installed. |

## The installed app: where to find it, how to launch

`pnpm run desktop:install` creates two shortcuts named **dsh** (whale icon on the brand-blue tile):

- **Desktop**: a `dsh` icon — double-click it like any PC application.
- **Start Menu**: `Start Menu\Programs\dsh.lnk` under your user profile. Press **Win+S** (or just open the Start menu) and type `dsh`; it also sits under all apps → **D** → dsh.

Either entry launches the same thing the dev run does: a window titled **DeepSeek Harness** appears once the UI is ready (a first launch spends a few seconds booting the local server; the window shows nothing before it is ready). Launching again while a window is already open just focuses it. Closing the window ends the local server and every process it spawned — no background residue, no tray icon.

## How this differs from the npm CLI (`npx @deepseek-ai/dsh`)

It is a different launch path over the same UI. `npx @deepseek-ai/dsh web` runs the published CLI, serves `http://127.0.0.1:3080`, and you open the page in a browser tab yourself; nothing owns a window. The desktop entries run **this checkout's** Electron shell (`apps/desktop`): the shell spawns the `dsh web` profile from source, picks a free port automatically, and owns the window and the process lifecycle. Because the shortcuts point into the checkout, moving or deleting the repository directory breaks them until you re-run `pnpm run desktop:install` from the new location.

## Behavior

| Aspect | Contract |
|---|---|
| Port | The child runs `dsh web --port 0 --no-open`; the OS picks a free port, the shell reads it from the readiness line, and the page appears only in the desktop window (the 文件 menu has 在浏览器中打开 for a browser tab). |
| Menu bar | Editor-style 文件/编辑/选择/查看/窗口/帮助: 新建会话 `Ctrl+N`, 打开设置 `Ctrl+,`, zoom `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, 切换侧栏 `Ctrl+B`, reload and developer tools. |
| Single instance | A second launch (shortcut or command) focuses the first window instead of spawning a second dsh runtime. |
| Process tree | Closing the window or quitting kills the child's whole process tree (`taskkill /T /F` on Windows). |
| Child exit | A dsh process that exits on its own shows an error dialog and closes the shell. |
| Window geometry | Size and position persist to `window-bounds.json` under Electron's userData directory, re-validated against the current display on load. |
| Resize | The three-column web layout already adapts to the viewport; the window adds only `minWidth`/`minHeight`. |
| Brand | The sidebar name and window title come from the locale string `brand.localBuild` in [`packages/client/locale/src/locales/`](../../packages/client/locale/src/locales/). |

## Environment overrides

| Variable | Purpose |
|---|---|
| `DSH_DESKTOP_NODE` | The Node executable that launches dsh (default: `node` on `PATH`). |
| `DSH_DESKTOP_ENTRY` | The dsh launcher module (default: `apps/cli/src/bin.ts`, the `pnpm dsh` source entry). |

## Background color

The window's own background pairs with the web UI's light `bg-base` token and is only visible before first paint, because the window stays hidden until the page is ready; the page applies the user's theme at load. Changing the UI's own colors happens in the theme system, not here: the palette and semantic tokens live in [`packages/client/ui-theme/src/styles/design-platform.css`](../../packages/client/ui-theme/src/styles/design-platform.css), and runtime themes register through `ThemeRuntime` in [`packages/client/ui-theme/src/client/index.ts`](../../packages/client/ui-theme/src/client/index.ts).

## Limitations

- The shell and the shortcuts drive a repository checkout; a packaged distribution (bundled Node runtime, `lib/`, and the web dist in an installer) is deferred.
- No renderer preload exists yet: one lands with the first native bridge (sandboxed preloads are CJS-only, so it is not a free stub).
- The app registration is Windows-only today; the shell itself runs wherever Electron does.

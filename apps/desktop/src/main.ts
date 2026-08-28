/**
 * Electron main process for dsh Desktop. The shell owns no agent logic: it
 * spawns the same `dsh web` profile the browser workflow uses (`--port 0` so
 * the OS picks a free port), waits for the web runtime's documented readiness
 * URL line, and loads the served UI in a BrowserWindow. Closing the window
 * tears the child process tree down; a child that dies on its own surfaces an
 * error dialog and quits with the window.
 * @module @deepseek-ai/dsh-desktop/main
 */

/* v8 ignore file -- the process-bound shell is exercised by launching the app. */

import { app, BrowserWindow, Menu, dialog, screen } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_HEIGHT, MIN_WIDTH, sanitizeBounds, type WindowBounds } from './bounds.ts'
import { parseReadyUrl } from './readiness.ts'

/** Environment override naming the Node executable that launches dsh; a packaged shell points this at its bundled runtime. */
const NODE_EXECUTABLE_ENV = 'DSH_DESKTOP_NODE'
/** Environment override naming the dsh launcher module; defaults to the repository source entry behind the `pnpm dsh` script. */
const LAUNCHER_ENTRY_ENV = 'DSH_DESKTOP_ENTRY'

/** Saved-geometry file name under Electron's userData directory. */
const BOUNDS_FILE = 'window-bounds.json'

/**
 * The window background pairs with the web UI's light `bg-base` token. It is
 * only visible before the page paints behind the hidden window and in resize
 * gutters; the in-page boot script applies the user's own theme at load.
 */
const BACKGROUND = '#ffffff'

/** The shell always runs the `web` profile: one fixed surface, no profile picker. */
const PROFILE = 'web'

/**
 * The launcher invocation. The default runs the repository from source — the
 * same entry the root `pnpm dsh` script uses, resolved against the checkout
 * this shell sits in — and the environment overrides re-target both halves
 * for a packaged shell.
 */
function dshLaunch(): { command: string; args: string[] } {
  const command = process.env[NODE_EXECUTABLE_ENV] ?? 'node'
  const entry = process.env[LAUNCHER_ENTRY_ENV] ?? 'apps/cli/src/bin.ts'
  return { command, args: ['--import', 'tsx/esm', entry, PROFILE, '--port', '0'] }
}

/** The repository checkout the shell drives: apps/desktop sits two levels under it. */
function repoRoot(): string {
  return path.resolve(app.getAppPath(), '..', '..')
}

/** The running dsh child, from spawn until its exit or the shell's shutdown. */
let child: ChildProcess | undefined
/** Set once a shutdown is intentional, so the child's exit stops being an error to surface. */
let shuttingDown = false

/** Spawn the dsh web profile; its output stays on the terminal the shell started from. */
function spawnDsh(): ChildProcess {
  const { command, args } = dshLaunch()
  const started = spawn(command, args, { cwd: repoRoot(), stdio: ['ignore', 'pipe', 'pipe'] })
  child = started
  shuttingDown = false
  started.stderr.pipe(process.stderr)
  return started
}

/**
 * Tear the child process tree down. The direct child is the single dsh Node
 * process, but a live session holds runtime children (PTY shells, workers)
 * that only a tree kill reclaims on Windows; elsewhere SIGTERM on the direct
 * child is the whole teardown.
 */
function stopChild(): void {
  const running = child
  if (running === undefined || shuttingDown) return
  shuttingDown = true
  if (process.platform === 'win32' && running.pid !== undefined) {
    spawn('taskkill', ['/pid', String(running.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    running.kill('SIGTERM')
  }
}

/**
 * Wait for the child's readiness URL line, echoing every stdout line through.
 * The child exiting (or failing to spawn at all) rejects, so a failed boot
 * surfaces as an error dialog instead of a window that never appears.
 * @param started - the freshly spawned dsh process.
 * @returns the URL the web runtime reports as served.
 */
function awaitReadyUrl(started: ChildProcess): Promise<URL> {
  return new Promise<URL>((resolve, reject) => {
    if (started.stdout === null) {
      reject(new Error('dsh stdout is unavailable'))
      return
    }
    const lines = createInterface({ input: started.stdout })
    let settled = false
    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      lines.close()
      started.off('exit', onExit)
      started.off('error', onError)
      settle()
    }
    const onLine = (line: string): void => {
      process.stdout.write(`${line}\n`)
      const url = parseReadyUrl(line)
      if (url !== undefined) finish(() => { resolve(url) })
    }
    const onExit = (): void => { finish(() => { reject(new Error('dsh exited before printing its readiness URL')) }) }
    const onError = (error: Error): void => { finish(() => { reject(new Error(`dsh could not be launched: ${error.message}`)) }) }
    lines.on('line', onLine)
    started.once('exit', onExit)
    started.once('error', onError)
  })
}

/** The saved-geometry document; a missing or corrupt file means "no remembered geometry". */
function loadBounds(): unknown {
  // ENOENT is a first run and a parse error is a corrupt file; both fall back
  // to the defaults, and nothing else can reach the failure.
  try {
    return JSON.parse(readFileSync(path.join(app.getPath('userData'), BOUNDS_FILE), 'utf8')) as unknown
  } catch {
    return undefined
  }
}

/** Persist the window geometry for the next run. */
function saveBounds(bounds: WindowBounds): void {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, BOUNDS_FILE), JSON.stringify(bounds))
}

/**
 * The window and taskbar icon, shipped beside the shell. Only Windows reads
 * the .ico form; other platforms fall back to the runtime default.
 */
function windowIcon(): string | undefined {
  const icon = path.join(app.getAppPath(), 'assets', 'dsh.ico')
  return process.platform === 'win32' && existsSync(icon) ? icon : undefined
}

/** Create the window with its saved geometry and lifetime hooks. */
function createWindow(): BrowserWindow {
  const saved = sanitizeBounds(loadBounds(), screen.getPrimaryDisplay().workArea)
  const icon = windowIcon()
  const window = new BrowserWindow({
    width: saved?.width ?? DEFAULT_WIDTH,
    height: saved?.height ?? DEFAULT_HEIGHT,
    ...(saved?.x !== undefined && { x: saved.x }),
    ...(saved?.y !== undefined && { y: saved.y }),
    ...(icon !== undefined && { icon }),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: BACKGROUND,
    show: false,
    title: 'dsh',
  })
  // Hidden until first paint: no blank or unthemed frame ever shows.
  window.once('ready-to-show', () => { window.show() })
  window.on('close', () => { saveBounds(window.getBounds()) })
  return window
}

/** Focus the existing shell's window; a second launch joins the first. */
function focusWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (window === undefined) return
  if (window.isMinimized()) window.restore()
  window.focus()
}

/** Install the stock role menu: zoom, reload, and devtools without hand-maintained accelerators. */
function installMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]))
}

/** Spawn dsh, wait for readiness, and load the served UI. */
async function boot(): Promise<void> {
  installMenu()
  const started = spawnDsh()
  let url: URL
  try {
    url = await awaitReadyUrl(started)
  } catch (error) {
    dialog.showErrorBox('dsh failed to start', error instanceof Error ? error.message : String(error))
    app.exit(1)
    return
  }
  const window = createWindow()
  started.on('exit', () => {
    if (shuttingDown) return
    dialog.showErrorBox('dsh exited', 'The dsh web process terminated unexpectedly; the shell closes with it.')
    window.destroy()
    app.exit(1)
  })
  await window.loadURL(url.href)
}

if (!app.requestSingleInstanceLock()) {
  // A second launch joins the first: the holder focuses its window and this
  // process exits before spawning a second dsh runtime.
  app.quit()
} else {
  app.on('second-instance', focusWindow)
  app.on('window-all-closed', () => { app.quit() })
  app.on('before-quit', stopChild)
  void app.whenReady().then(boot)
}

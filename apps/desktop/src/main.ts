/**
 * Electron main process for dsh Desktop. The shell owns no agent logic: it
 * spawns the same `dsh web` profile the browser workflow uses (`--port 0` so
 * the OS picks a free port, `--no-open` so the page appears only here),
 * waits for the web runtime's documented readiness URL line, and loads the
 * served UI in a chrome-less BrowserWindow whose title bar is the injected
 * in-page strip (see topbar.ts). Closing the window tears the child process
 * tree down; a child that dies on its own surfaces an error dialog and quits
 * with the window.
 * @module @deepseek-ai/dsh-desktop/main
 */

/* v8 ignore file -- the process-bound shell is exercised by launching the app. */

import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { detectImageMime } from './image-mime.ts'
import { PET_HEIGHT, PET_WIDTH, petStateScript, type PetBalanceState } from './pet.ts'
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_HEIGHT, MIN_WIDTH, sanitizeBounds, type WindowBounds } from './bounds.ts'
import { parseReadyUrl } from './readiness.ts'
import { TOPBAR_SCRIPT } from './topbar.ts'

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

/** One zoom step in webContents zoom-level units; 0 means "reset to 100%". */
const ZOOM_STEP = 0.5

/** The page-relative URL of the imported background image, served by the dsh web server. */
const BACKGROUND_IMAGE_URL = '/background-image'

/** Largest accepted imported background image. */
const MAX_BACKGROUND_BYTES = 30 * 1024 * 1024

/**
 * The launcher invocation. The default runs the repository from source — the
 * same entry the root `pnpm dsh` script uses, resolved against the checkout
 * this shell sits in — and the environment overrides re-target both halves
 * for a packaged shell. `--no-open` keeps the served page inside this window:
 * without it the web runtime also hands the URL to the default browser, which
 * would open a second surface beside the shell.
 */
function dshLaunch(): { command: string; args: string[] } {
  const command = process.env[NODE_EXECUTABLE_ENV] ?? 'node'
  const entry = process.env[LAUNCHER_ENTRY_ENV] ?? 'apps/cli/src/bin.ts'
  return { command, args: ['--import', 'tsx/esm', entry, PROFILE, '--port', '0', '--no-open'] }
}

/** The repository checkout the shell drives: apps/desktop sits two levels under it. */
function repoRoot(): string {
  return path.resolve(app.getAppPath(), '..', '..')
}

/** The running dsh child, from spawn until its exit or the shell's shutdown. */
let child: ChildProcess | undefined
/** Set while a quit is in flight, so the main window's close handler lets the final close through. */
let quitting = false
/** The main window; the pet card is a secondary surface that never outlives it. */
let mainWindow: BrowserWindow | undefined
/** Set once a shutdown is intentional, so the child's exit stops being an error to surface. */
let shuttingDown = false
/**
 * The readiness URL exactly as printed: it carries the launch token that
 * mints the auth cookie. The window's current URL loses the token after the
 * page's token-for-cookie exchange, so 在浏览器中打开 must hand out this one.
 */
let readyUrl: URL | undefined

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
    const onExit = (): void =>{  finish(() => { reject(new Error('dsh exited before printing its readiness URL')) }) }
    const onError = (error: Error): void =>{  finish(() => { reject(new Error(`dsh could not be launched: ${error.message}`)) }) }
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

/** Create the chrome-less window: the injected in-page strip is the title bar. */
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
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.cjs'),
    },
  })
  // Hidden until first paint: no blank or unthemed frame ever shows.
  window.once('ready-to-show', () => { window.show() })
  window.on('close', (event) => {
    saveBounds(window.getBounds())
    // 常驻模式：关主窗口 = 收起界面，后台服务与桌宠继续跑；双击图标秒回。
    if (keepAliveEnabled() && !quitting) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    mainWindow = undefined
    app.quit()
  })
  mainWindow = window
  return window
}

/** Focus the existing shell's window; a second launch joins the first. */
function focusWindow(): void {
  const window = mainWindow !== undefined && !mainWindow.isDestroyed() ? mainWindow : BrowserWindow.getAllWindows()[0]
  if (window === undefined) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

/** Saved shell preferences; a missing or corrupt file means all defaults. */
function loadPrefs(): { keepAlive: boolean } {
  // 坏文件只损失偏好，不给启动添堵。
  try {
    const parsed = JSON.parse(readFileSync(path.join(app.getPath('userData'), 'desktop-prefs.json'), 'utf8')) as { keepAlive?: unknown }
    return { keepAlive: parsed['keepAlive'] !== false }
  } catch {
    return { keepAlive: true }
  }
}

function savePrefs(prefs: { keepAlive: boolean }): void {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'desktop-prefs.json'), JSON.stringify(prefs))
}

/** Whether closing the main window should keep the background service running. */
function keepAliveEnabled(): boolean {
  return loadPrefs().keepAlive
}

/** The window a menu command acts on: the main window, else the focused one. */
function activeWindow(): BrowserWindow | undefined {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) return mainWindow
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/**
 * Click a control inside the served UI. The web app exposes its sidebar
 * controls as plain buttons whose CSS-module class names keep stable stems,
 * so menu commands drive them through stem matching instead of hard-coding
 * translated labels.
 */
function clickInRenderer(selector: string): void {
  void activeWindow()?.webContents.executeJavaScript(
    `document.querySelector(${JSON.stringify(selector)})?.click()`,
    true,
  )
}

/** Forward one keyboard chord into the page, so a menu item rides the same path as the physical key. */
function sendChord(key: string): void {
  activeWindow()?.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers: ['control'] })
}

/** Apply a zoom step (or a reset) to the window the menu or shortcut targets. */
function applyZoom(window: BrowserWindow | undefined, step: number): void {
  if (window === undefined) return
  const contents = window.webContents
  contents.setZoomLevel(step === 0 ? 0 : contents.getZoomLevel() + step)
}

/**
 * The Ctrl/ Cmd zoom family, resolved from one physical-key event: `=`, `+`
 * (Shift+=), and the numpad add key all zoom in. Electron's built-in zoomIn
 * role only binds `Plus`, which a plain Ctrl++ never produces, so the shell
 * owns the mapping here instead of in menu accelerators.
 */
function zoomStepForKey(input: { control: boolean; meta: boolean; key: string; code: string }): number | undefined {
  const zoomHeld = input.control || input.meta
  if (!zoomHeld) return undefined
  if (input.key === '=' || input.key === '+' || input.code === 'NumpadAdd') return ZOOM_STEP
  if (input.key === '-' || input.code === 'NumpadSubtract') return -ZOOM_STEP
  if (input.key === '0') return 0
  return undefined
}

/** Push the window state (currently the maximized flag) to the in-page strip. */
function broadcastShellState(window: BrowserWindow): void {
  window.webContents.send('shell:state', { maximized: window.isMaximized() })
}

/** Balance poll cadence for the desktop pet (the account total moves slowly). */
const PET_POLL_MS = 3 * 60 * 1000

/** The pet card window; created lazily, hidden — never destroyed — by its close button. */
let petWindow: BrowserWindow | undefined
let petVisible = true
let lastPetState: PetBalanceState = { kind: 'nokey', message: '正在读取账户余额…' }

async function pollPetBalance(): Promise<void> {
  if (readyUrl === undefined) return
  try {
    // The dsh web server owns the API key (its env carries the credential the
    // llm-deepseek adapter resolves) and proxies the balance with it — the pet
    // asks the same account the harness runs on; the key never leaves it.
    const response = await fetch(new URL('/deepseek-balance', readyUrl.origin))
    lastPetState = await response.json() as PetBalanceState
  } catch (error) {
    lastPetState = { kind: 'error', message: error instanceof Error ? error.message : String(error) }
  }
  petWindow?.webContents.executeJavaScript(petStateScript(lastPetState), true).then(() => {}, () => {
    // The pet page can be mid-navigation; the next poll repaints it.
  })
}

/** Show the pet docked to the screen's right edge, creating it on first use. */
function showPet(): void {
  if (petWindow !== undefined && !petWindow.isDestroyed()) {
    petWindow.show()
    return
  }
  const { workArea } = screen.getPrimaryDisplay()
  petWindow = new BrowserWindow({
    width: PET_WIDTH,
    height: PET_HEIGHT,
    x: workArea.x + workArea.width - PET_WIDTH - 16,
    y: workArea.y + workArea.height - PET_HEIGHT - 96,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
  })
  petWindow.setAlwaysOnTop(true, 'screen-saver')
  petWindow.on('closed', () => { petWindow = undefined })
  void petWindow.loadFile(path.join(app.getAppPath(), 'pet.html'))
  void petWindow.webContents.executeJavaScript(petStateScript(lastPetState), true).then(() => {}, () => {})
  void pollPetBalance()
}

function runPetAction(action: 'pet:toggle' | 'pet:hide' | 'pet:refresh'): void {
  if (action === 'pet:hide') {
    petWindow?.hide()
    petVisible = false
    return
  }
  if (action === 'pet:refresh') {
    void pollPetBalance()
    if (!petVisible) showPet()
    return
  }
  petVisible = !petVisible
  if (petVisible) showPet()
  else petWindow?.hide()
}

/**
 * The main-side actions the in-page strip (and the keyboard map) invoke:
 * window controls, zoom, reloads, dialogs, the desktop pet, and the external
 * browser handoff.
 */
function runShellAction(action: string): void {
  const window = activeWindow()
  switch (action) {
    case 'openInBrowser': {
      const url = readyUrl?.href ?? window?.webContents.getURL()
      if (url !== undefined) void shell.openExternal(url)
      break
    }
    case 'quit': app.quit(); break
    case 'zoom:in': applyZoom(window, ZOOM_STEP); break
    case 'zoom:out': applyZoom(window, -ZOOM_STEP); break
    case 'zoom:reset': applyZoom(window, 0); break
    case 'reload': window?.webContents.reload(); break
    case 'forceReload': window?.webContents.reloadIgnoringCache(); break
    case 'devtools': window?.webContents.toggleDevTools(); break
    case 'win:minimize': window?.minimize(); break
    case 'win:toggleMaximize':
      if (window === undefined) break
      if (window.isMaximized()) window.unmaximize()
      else window.maximize()
      broadcastShellState(window)
      break
    case 'win:close': window?.close(); break
    case 'about':
      void dialog.showMessageBox({
        type: 'info',
        title: '关于 dsh',
        message: `上官云霄的 DSH（dsh Desktop）\nElectron ${process.versions.electron}\nNode ${process.versions.node}`,
      })
      break
    case 'upstream': void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness'); break
    case 'pet:toggle': runPetAction('pet:toggle'); break
    case 'pet:hide': runPetAction('pet:hide'); break
    case 'pet:refresh': runPetAction('pet:refresh'); break
    case 'keepalive:toggle': {
      const prefs = loadPrefs()
      prefs.keepAlive = !prefs.keepAlive
      savePrefs(prefs)
      break
    }
    default: break
  }
}

/**
 * The full Ctrl/ Cmd keyboard map, resolved from physical keys: the zoom
 * family (see zoomStepForKey), the sidebar commands, the composer chords,
 * and the reload family. With the native menu bar gone, this is the one
 * accelerator path — the strip's shortcut texts are pure display.
 */
function installKeyboardMap(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return
    const zoom = zoomStepForKey(input)
    if (zoom !== undefined) {
      event.preventDefault()
      applyZoom(window, zoom)
      return
    }
    const key = input.key.toLowerCase()
    const plain = ! input.shift
    switch (key) {
      case 'n':
        if (plain) { event.preventDefault(); clickInRenderer('[class*="newSession"]') }
        break
      case ',':
        if (plain) { event.preventDefault(); clickInRenderer('[class*="settingsArea"] button') }
        break
      case 'b':
        if (plain) { event.preventDefault(); clickInRenderer('[class*="logoRow"] [class*="toggle"]') }
        break
      case 'd':
        if (plain) { event.preventDefault(); sendChord('d') }
        break
      case 'k':
        if (plain) { event.preventDefault(); sendChord('k') }
        break
      case 'm':
        if (plain) { event.preventDefault(); runShellAction('win:minimize') }
        break
      case 'w':
        if (plain) { event.preventDefault(); runShellAction('win:close') }
        break
      case 'r':
        event.preventDefault()
        if (input.shift) window.webContents.reloadIgnoringCache()
        else window.webContents.reload()
        break
      case 'i':
        if (input.shift) { event.preventDefault(); window.webContents.toggleDevTools() }
        break
      default: break
    }
  })
}

/** Inject the in-page title bar; idempotent, re-run after every page load. */
function injectTopBar(window: BrowserWindow): void {
  void window.webContents.executeJavaScript(TOPBAR_SCRIPT, true).then(() => {}, () => {
    // A navigation can outpace the injection; the next did-finish-load
    // re-runs it, so nothing else can reach this failure.
  })
}

/** Spawn dsh, wait for readiness, and load the served UI under the strip. */
async function boot(): Promise<void> {
  ipcMain.handle('shell:background-image', (_event, bytes: unknown) => {
    if (!(bytes instanceof ArrayBuffer) && !(ArrayBuffer.isView(bytes) && bytes.buffer instanceof ArrayBuffer)) {
      throw new Error('background image payload must be bytes')
    }
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (view.byteLength === 0 || view.byteLength > MAX_BACKGROUND_BYTES) {
      throw new Error(`background image must be 1 byte..${String(MAX_BACKGROUND_BYTES)} bytes`)
    }
    // The image lives in the Harness home and is served by the dsh web server
    // itself at the page-relative URL, so the configured background works
    // identically in this window and in any browser. The mime rides a sidecar
    // (the bytes are stored extension-less); each import overwrites both. The
    // version query is the re-fetch trigger: without a changed URL the page's
    // inline style is byte-identical, no request fires, and the previous
    // image stays painted.
    writeFileSync(dshHomePath('background-image'), view)
    writeFileSync(dshHomePath('background-image.type'), detectImageMime(view))
    return `${BACKGROUND_IMAGE_URL}?v=${String(Date.now())}`
  })
  const started = spawnDsh()
  let url: URL
  try {
    url = await awaitReadyUrl(started)
  } catch (error) {
    dialog.showErrorBox('dsh failed to start', error instanceof Error ? error.message : String(error))
    app.exit(1)
    return
  }
  readyUrl = url
  const window = createWindow()
  installKeyboardMap(window)
  window.on('maximize', () => { broadcastShellState(window) })
  window.on('unmaximize', () => { broadcastShellState(window) })
  started.on('exit', () => {
    if (shuttingDown) return
    dialog.showErrorBox('dsh exited', 'The dsh web process terminated unexpectedly; the shell closes with it.')
    window.destroy()
    app.exit(1)
  })
  await window.loadURL(url.href)
  injectTopBar(window)
  window.webContents.on('did-finish-load', () => { injectTopBar(window) })
  if (petVisible) showPet()
  void pollPetBalance()
  const petPoll = setInterval(() => { void pollPetBalance() }, PET_POLL_MS)
  window.on('closed', () => { clearInterval(petPoll) })
}

if (!app.requestSingleInstanceLock()) {
  // A second launch joins the first: the holder focuses its window and this
  // process exits before spawning a second dsh runtime.
  app.quit()
} else {
  app.on('second-instance', focusWindow)
  app.on('window-all-closed', () => { app.quit() })
  app.on('before-quit', () => {
    // The keep-alive close handler hides instead of closing; an intentional
    // quit must let the final close through or the app never exits.
    quitting = true
    stopChild()
  })
  ipcMain.on('pet:move-by', (_event, delta: unknown) => {
    if (petWindow === undefined || petWindow.isDestroyed()) return
    const d = delta as { dx?: unknown; dy?: unknown }
    if (typeof d.dx !== 'number' || typeof d.dy !== 'number' || (d.dx === 0 && d.dy === 0)) return
    const [x, y] = petWindow.getPosition()
    if (x === undefined || y === undefined) return
    petWindow.setPosition(x + Math.round(d.dx), y + Math.round(d.dy))
  })
  ipcMain.on('shell:action', (_event, action: unknown) => {
    if (typeof action === 'string') runShellAction(action)
  })
  void app.whenReady().then(boot)
}

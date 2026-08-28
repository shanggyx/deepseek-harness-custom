/**
 * Register dsh Desktop as a clickable Windows application: a Start Menu
 * shortcut ("dsh", surfaced by Win+S and the start-menu app list) plus a
 * desktop shortcut, both launching the Electron shell from this checkout.
 * `--remove` deletes both shortcuts again. Other platforms have no
 * counterpart registration, so the script refuses to run there.
 * @module @deepseek-ai/dsh-desktop/install-app
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const remove = process.argv[2] === '--remove'
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appDir, '..', '..')

/** Built artifacts the shortcuts depend on; a missing one names its build command. */
function assertBuiltArtifacts(): void {
  const missing: string[] = []
  if (!existsSync(resolve(appDir, 'lib', 'main.js'))) missing.push('pnpm --filter @deepseek-ai/dsh-desktop run build')
  if (!existsSync(resolve(repoRoot, 'apps', 'web', 'dist', 'index.html'))) missing.push('pnpm --filter @deepseek-ai/dsh-web-frontend run build')
  if (missing.length > 0) {
    console.error(`dsh desktop: missing build artifacts; from the repository root run:\n  ${missing.join('\n  ')}`)
    process.exit(1)
  }
}

/** The electron distribution binary; its postinstall downloads it during pnpm install. */
function electronExecutable(): string {
  const require = createRequire(import.meta.url)
  const packageDir = dirname(require.resolve('electron'))
  const executable = resolve(packageDir, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
  if (!existsSync(executable)) {
    console.error(`dsh desktop: the Electron binary is not installed at ${executable}; run \`pnpm install\` (the electron entry in the workspace allowBuilds list downloads it).`)
    process.exit(1)
  }
  return executable
}

/** Run the shortcut writer; the resolved paths travel as env vars, never as inline shell text. */
function runPowerShell(script: string, removeOnly: boolean): void {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DSH_ELECTRON_EXE: removeOnly ? '' : electronExecutable(),
      DSH_APP_DIR: appDir,
      DSH_ICON: resolve(appDir, 'assets', 'dsh.ico'),
    },
  })
  if (result.stdout.trim().length > 0) console.log(result.stdout.trim())
  if (result.status !== 0) {
    console.error(`dsh desktop: shortcut registration failed:\n${result.stderr}`)
    process.exit(result.status ?? 1)
  }
}

if (process.platform !== 'win32') {
  console.error(`dsh desktop: the shortcut registration is a Windows integration; nothing to ${remove ? 'remove' : 'install'} on ${process.platform}.`)
  process.exit(1)
}

if (remove) {
  runPowerShell(`
$ErrorActionPreference = 'Stop'
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $path = Join-Path $dir 'dsh.lnk'
  if (Test-Path $path) { Remove-Item $path; Write-Output "removed $path" } else { Write-Output "absent  $path" }
}`, true)
} else {
  assertBuiltArtifacts()
  runPowerShell(`
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $path = Join-Path $dir 'dsh.lnk'
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $env:DSH_ELECTRON_EXE
  $shortcut.Arguments = '"' + $env:DSH_APP_DIR + '"'
  $shortcut.WorkingDirectory = $env:DSH_APP_DIR
  $shortcut.IconLocation = $env:DSH_ICON + ',0'
  $shortcut.Description = 'DeepSeek Harness'
  $shortcut.Save()
  Write-Output "created $path"
}`, false)
  console.log('dsh desktop: search for "dsh" in the start menu (Win+S) or use the desktop shortcut.')
}

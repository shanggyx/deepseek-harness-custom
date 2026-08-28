import { defineConfig } from 'tsdown'

/**
 * dsh Desktop ships one entry: the Electron main process, referenced by the
 * package `main` field. A renderer preload waits until a native bridge is
 * actually needed (sandboxed preloads are CJS-only, so an ESM-shell preload
 * is not a free stub). Declarations come from `tsc -b` (dts: false),
 * matching every package.
 */
export default defineConfig({
  entry: ['lib/types/main.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  // electron resolves at runtime inside the Electron binary; bundling it
  // inlines the package's install-check module (a devDependency is not
  // auto-external) and crashes ESM load on its __dirname.
  external: ['electron'],
})

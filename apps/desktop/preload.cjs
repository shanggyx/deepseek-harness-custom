/**
 * Renderer bridge for the shell's in-page title bar: the only surface the
 * sandboxed renderer needs is one fire-and-forget action channel into the
 * main process (window controls, zoom, reload, dialogs, external opens).
 * Plain CJS because sandboxed preloads cannot load ESM.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshShell', {
  /**
   * Run one named shell action (see SHELL_ACTIONS in the main process).
   * @param action - the action id, e.g. 'win:minimize' or 'zoom:in'.
   */
  do(action) {
    ipcRenderer.send('shell:action', String(action))
  },
  /**
   * Subscribe to shell state broadcasts (currently `{ maximized }`), so the
   * in-page title bar can swap the maximize/restore glyph.
   * @param callback - called with the latest state on every broadcast.
   */
  onState(callback) {
    ipcRenderer.on('shell:state', (_event, state) => {
      callback(state)
    })
  },
  /**
   * Nudge the pet window by a screen-pixel delta (the drag-by-the-body path:
   * the renderer tracks the pointer and streams small deltas here).
   * @param dx - horizontal delta.
   * @param dy - vertical delta.
   */
  moveBy(dx, dy) {
    ipcRenderer.send('pet:move-by', { dx: Number(dx), dy: Number(dy) })
  },
  /**
   * Store an imported background image and resolve to the app-protocol URL
   * the served page loads it from.
   * @param bytes - the image bytes.
   * @returns the image URL ('app://background-image').
   */
  async setBackgroundImage(bytes) {
    return ipcRenderer.invoke('shell:background-image', bytes)
  },
})

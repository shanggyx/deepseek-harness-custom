/**
 * The in-page title bar the shell injects over the served UI: brand, the
 * editor-standard menus, and the window controls, all plain DOM. Hiding the
 * native title bar hands this strip every chrome concern at once — its
 * colors ride the page's theme tokens (浅色/深色/跟随浏览器 with no native
 * sync), its left padding matches the sidebar, and its dropdowns own their
 * width and right-aligned shortcut column. Page-side entries run directly;
 * the rest cross to the main process through the preload bridge.
 * @module @deepseek-ai/dsh-desktop/topbar
 */

export const TOPBAR_SCRIPT = String.raw`(function () {
  if (document.getElementById('dsh-topbar')) return
  var style = document.createElement('style')
  style.textContent = [
    'body { padding-top: 34px; box-sizing: border-box; }',
    '#dsh-topbar { position: fixed; top: 0; left: 0; right: 0; height: 34px; z-index: 2147483000;',
    '  display: flex; align-items: stretch; padding: 0 8px 0 12px; gap: 2px;',
    '  background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, inherit);',
    '  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));',
    '  -webkit-app-region: drag; user-select: none; font-size: 13px; }',
    '#dsh-topbar .dsh-logo { align-self: center; height: 20px; width: auto; margin: 0 14px 0 2px; }',
    '#dsh-topbar .dsh-menu-btn { -webkit-app-region: no-drag; display: flex; align-items: center; padding: 0 10px;',
    '  border: none; background: transparent; color: inherit; font: inherit; cursor: default; border-radius: 6px; }',
    '#dsh-topbar .dsh-menu-btn:hover, #dsh-topbar .dsh-menu-btn[data-open="true"]',
    '  { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }',
    '#dsh-topbar .dsh-spring { flex: 1; }',
    '#dsh-topbar .dsh-win-btn { -webkit-app-region: no-drag; display: flex; align-items: center; justify-content: center;',
    '  width: 46px; border: none; background: transparent; color: inherit; cursor: default; }',
    '#dsh-topbar .dsh-win-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.08)); }',
    '#dsh-topbar .dsh-win-close:hover { background: #e81123; color: #ffffff; }',
    '#dsh-topbar-dropdown { position: fixed; z-index: 2147483001; min-width: 220px; padding: 6px;',
    '  background: var(--dsw-alias-bg-base, #ffffff); color: var(--dsw-alias-label-primary, inherit);',
    '  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 10px;',
    '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); font-size: 13px; }',
    '#dsh-topbar-dropdown .dsh-item { display: flex; align-items: center; justify-content: space-between; gap: 12px;',
    '  padding: 6px 10px; border-radius: 6px; cursor: default; white-space: nowrap; }',
    '#dsh-topbar-dropdown .dsh-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }',
    '#dsh-topbar-dropdown .dsh-item .dsh-shortcut { color: var(--dsw-alias-label-tertiary, #808080); }',
    '#dsh-topbar-dropdown .dsh-sep { height: 1px; margin: 5px 8px; background: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); }'
  ].join('\n')
  document.head.appendChild(style)

  var MENUS = [
    { name: '文件', items: [
      { label: '新建会话', shortcut: 'Ctrl+N', action: 'page', selector: '[class*="newSession"]' },
      { sep: true },
      { label: '打开设置', shortcut: 'Ctrl+,', action: 'page', selector: '[class*="settingsArea"] button' },
      { label: '在浏览器中打开', action: 'main', main: 'openInBrowser' },
      { sep: true },
      { label: '退出', action: 'main', main: 'quit' },
    ] },
    { name: '编辑', items: [
      { label: '撤销', shortcut: 'Ctrl+Z', action: 'exec', cmd: 'undo' },
      { label: '重做', shortcut: 'Ctrl+Y', action: 'exec', cmd: 'redo' },
      { sep: true },
      { label: '剪切', shortcut: 'Ctrl+X', action: 'exec', cmd: 'cut' },
      { label: '复制', shortcut: 'Ctrl+C', action: 'exec', cmd: 'copy' },
      { label: '粘贴', shortcut: 'Ctrl+V', action: 'exec', cmd: 'paste' },
    ] },
    { name: '选择', items: [
      { label: '全选', shortcut: 'Ctrl+A', action: 'exec', cmd: 'selectAll' },
      { sep: true },
      { label: '添加下一个匹配项', shortcut: 'Ctrl+D', action: 'chord', key: 'd' },
      { label: '跳过当前匹配项', shortcut: 'Ctrl+K', action: 'chord', key: 'k' },
    ] },
    { name: '查看', items: [
      { label: '放大', shortcut: 'Ctrl+=', action: 'main', main: 'zoom:in' },
      { label: '缩小', shortcut: 'Ctrl+-', action: 'main', main: 'zoom:out' },
      { label: '重置缩放', shortcut: 'Ctrl+0', action: 'main', main: 'zoom:reset' },
      { sep: true },
      { label: '切换侧栏', shortcut: 'Ctrl+B', action: 'page', selector: '[class*="logoRow"] [class*="toggle"]' },
      { sep: true },
      { label: '重新加载', shortcut: 'Ctrl+R', action: 'main', main: 'reload' },
      { label: '强制重新加载', shortcut: 'Ctrl+Shift+R', action: 'main', main: 'forceReload' },
      { label: '开发者工具', shortcut: 'Ctrl+Shift+I', action: 'main', main: 'devtools' },
    ] },
    { name: '窗口', items: [
      { label: '最小化', shortcut: 'Ctrl+M', action: 'main', main: 'win:minimize' },
      { label: '关闭窗口', shortcut: 'Ctrl+W', action: 'main', main: 'win:close' },
    ] },
    { name: '帮助', items: [
      { label: '关于 dsh', action: 'main', main: 'about' },
      { label: '上游仓库', action: 'main', main: 'upstream' },
    ] },
  ]

  var strip = document.createElement('div')
  strip.id = 'dsh-topbar'
  var logo = document.createElement('img')
  logo.className = 'dsh-logo'
  logo.src = '/favicon.svg'
  logo.alt = ''
  strip.appendChild(logo)
  var openButton = null
  var maximized = false
  var maximizeButton = null

  var WIN_ICONS = {
    minimize: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" fill="none"/></svg>',
    maximize: '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>',
    restore: '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="2.5" width="7.5" height="7.5" fill="none" stroke="currentColor"/><path d="M2.5 2.5v-2h7.5v7.5h-2" fill="none" stroke="currentColor"/></svg>',
    close: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" fill="none"/></svg>',
  }

  function closeDropdown() {
    var existing = document.getElementById('dsh-topbar-dropdown')
    if (existing !== null) existing.remove()
    if (openButton !== null) { openButton.removeAttribute('data-open'); openButton = null }
  }

  function openMenu(button, menu) {
    closeDropdown()
    openButton = button
    button.setAttribute('data-open', 'true')
    var dropdown = document.createElement('div')
    dropdown.id = 'dsh-topbar-dropdown'
    menu.items.forEach(function (item) {
      if (item.sep === true) {
        var sep = document.createElement('div')
        sep.className = 'dsh-sep'
        dropdown.appendChild(sep)
        return
      }
      var row = document.createElement('div')
      row.className = 'dsh-item'
      var label = document.createElement('span')
      label.textContent = item.label
      row.appendChild(label)
      if (item.shortcut !== undefined) {
        var shortcut = document.createElement('span')
        shortcut.className = 'dsh-shortcut'
        shortcut.textContent = item.shortcut
        row.appendChild(shortcut)
      }
      row.addEventListener('click', function () { closeDropdown(); run(item) })
      dropdown.appendChild(row)
    })
    document.body.appendChild(dropdown)
    var edge = button.getBoundingClientRect()
    var width = dropdown.getBoundingClientRect().width
    var left = Math.min(edge.left, window.innerWidth - width - 8)
    dropdown.style.left = Math.max(8, left) + 'px'
    dropdown.style.top = '34px'
  }

  function run(item) {
    if (item.action === 'page') { var target = document.querySelector(item.selector); if (target !== null) target.click(); return }
    if (item.action === 'exec') { document.execCommand(item.cmd); return }
    if (item.action === 'chord') {
      var event = new KeyboardEvent('keydown', { key: item.key, ctrlKey: true, bubbles: true })
      (document.activeElement || document.body).dispatchEvent(event)
      return
    }
    if (item.action === 'main' && window.dshShell !== undefined) window.dshShell.do(item.main)
  }

  MENUS.forEach(function (menu) {
    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'dsh-menu-btn'
    button.textContent = menu.name
    button.addEventListener('click', function () {
      if (openButton === button) closeDropdown()
      else openMenu(button, menu)
    })
    button.addEventListener('mouseenter', function () {
      if (openButton !== null && openButton !== button) openMenu(button, menu)
    })
    strip.appendChild(button)
  })
  var spring = document.createElement('span')
  spring.className = 'dsh-spring'
  strip.appendChild(spring)

  function winButton(icon, action, extraClass) {
    var button = document.createElement('button')
    button.type = 'button'
    button.className = extraClass === undefined ? 'dsh-win-btn' : 'dsh-win-btn ' + extraClass
    button.innerHTML = icon
    button.addEventListener('click', function () {
      if (window.dshShell !== undefined) window.dshShell.do(action)
    })
    strip.appendChild(button)
    return button
  }
  winButton(WIN_ICONS.minimize, 'win:minimize')
  maximizeButton = winButton(maximized ? WIN_ICONS.restore : WIN_ICONS.maximize, 'win:toggleMaximize')
  winButton(WIN_ICONS.close, 'win:close', 'dsh-win-close')
  function applyMaximized() {
    if (maximizeButton !== null) maximizeButton.innerHTML = maximized ? WIN_ICONS.restore : WIN_ICONS.maximize
  }
  if (window.dshShell !== undefined && window.dshShell.onState !== undefined) {
    window.dshShell.onState(function (state) {
      if (typeof state.maximized !== 'boolean') return
      maximized = state.maximized
      applyMaximized()
    })
  }
  document.body.appendChild(strip)
  document.addEventListener('click', function (event) {
    var target = event.target
    if (openButton !== null && target instanceof Element
      && target.closest('#dsh-topbar-dropdown') === null && target.closest('.dsh-menu-btn') === null) closeDropdown()
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && openButton !== null) closeDropdown()
  })

  // The sidebar brand doubles as the browser handoff: it opens the served
  // page in the OS browser instead of its in-page New Session shortcut.
  document.addEventListener('click', function (event) {
    var target = event.target
    if (target instanceof Element && target.closest('[class*="logoRow"] [class*="brand"]') !== null) {
      event.preventDefault()
      event.stopPropagation()
      if (window.dshShell !== undefined) window.dshShell.do('openInBrowser')
    }
  }, true)

  // Full-viewport panels (settings) mount as fixed descendants of the sidebar
  // column; the strip reserves their top 34px, so each fixed overlay shifts
  // down as it appears. Scoped by computed position: local absolute overlays
  // near the composer must keep their own geometry. The settings panel's own
  // height is viewport-derived (one height for every section, upstream), which
  // strands a blank band under short sections — here it follows its content
  // instead, capped below the strip, and the overlay's centering keeps it
  // vertically centered.
  var sidebarRoot = document.querySelector('[class*="logoRow"]')?.parentElement
  if (sidebarRoot !== undefined && sidebarRoot !== null) {
    var fitFixedOverlays = function (node) {
      if (!(node instanceof Element)) return
      var candidates = node.matches('[class*="overlay"]') ? [node] : Array.prototype.slice.call(node.querySelectorAll('[class*="overlay"]'))
      candidates.forEach(function (el) {
        if (getComputedStyle(el).position !== 'fixed') return
        el.style.paddingTop = '34px'
        el.style.boxSizing = 'border-box'
        var panel = el.querySelector('[class*="panel"]')
        if (panel !== null) {
          panel.style.height = 'auto'
          panel.style.maxHeight = 'calc(100vh - 82px)'
        }
      })
    }
    var overlayObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(fitFixedOverlays)
      })
    })
    overlayObserver.observe(sidebarRoot, { childList: true, subtree: true })
  }
})()`

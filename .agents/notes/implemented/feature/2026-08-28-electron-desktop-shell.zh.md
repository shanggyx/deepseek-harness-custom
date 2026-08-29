# Agent Note: Electron desktop shell

Status: implemented

[English](2026-08-28-electron-desktop-shell.md) | 中文

## Problem

dsh 的交互表面是浏览器 UI：`dsh web` 在 127.0.0.1 上服务 React 应用，用户在浏览器标签页里打开它。这个形态没有桌面存在感——没有任务栏身份、没有记忆的窗口、没有应用生命周期——产品看起来像"一个网站"，而不是 agent 自己的应用。被删除的终端 TUI 曾承担这种应用感；它移除后，非浏览器窗口的叙事完全空缺。

重新引入窗口不能复活第二套 UI 栈：web 表面拥有会话、设置和主题系统，任何并列的渲染实现都会把每一份都分叉出去。

## Decision

`apps/desktop`（`@deepseek-ai/dsh-desktop`）是现有 web 表面之上的 Electron 外壳。主进程以子进程方式拉起 `dsh web --port 0`，解析 web runtime 早已为 supervisor 打印的就绪 URL 行（[`packages/bundle/web-app/src/index.ts`](../../../../packages/bundle/web-app/src/index.ts) 中的 `dsh web: http://…`），再把该 URL 装入 `BrowserWindow`。外壳不新增插件行、传输层或 UI 代码：一切用户可见行为都仍是 web 表面行为；webserver 头注释预期的 Electron 兼容形态由朴素的 localhost 形状实现。

### 启动与生命周期

默认启动从源码运行仓库（在检出根目录执行 `node --import tsx/esm apps/cli/src/bin.ts web --port 0`），与根 `pnpm dsh` 脚本同一入口；`DSH_DESKTOP_NODE` 与 `DSH_DESKTOP_ENTRY` 为将来的打包外壳重新指定两端。`--port 0` 让操作系统挑选空闲端口，外壳永远不会与组合默认端口相撞。关闭窗口会终结子进程的整棵进程树（Windows 上 `taskkill /T /F`，其他平台对直接子进程 SIGTERM）；子进程自行退出时弹出错误对话框并关闭外壳。第二次启动拿不到单实例锁，只会聚焦第一个窗口，不会拉起第二个 dsh 运行时。

### 窗口行为

窗口几何持久化在 Electron userData 目录下的 `window-bounds.json`，加载时按当前显示器重新校验：低于三列最小值的尺寸或落在所有显示器之外的位置回退到默认值。缩放适应本身不需要新代码——web 布局的 `ResizeObserver` 与列求解器已经在跟踪视口——所以外壳只补充 `minWidth`/`minHeight` 和标准缩放菜单 role。窗口在首帧前保持隐藏，配合页面 boot 主题脚本消除一切背景闪烁；外壳自己的 `backgroundColor` 只为首帧前的空档和缩放留白与亮色 base token 配对。

### Windows 应用注册

`scripts/install-app.ts` 让外壳像已安装的程序一样可达：它创建名为 `dsh` 的开始菜单与桌面快捷方式，二者都以检出里的 `electron.exe` 为目标、以应用目录为唯一参数，以随附的 `assets/dsh.ico`（品牌渐变底上的 favicon 鲸鱼）为图标，BrowserWindow 也使用同一图标。快捷方式落在用户自己的 Programs 与 Desktop 文件夹，因此 `Get-StartApps`、开始菜单搜索（Win+S）与桌面图标都能呈现该应用，无需安装器或管理员权限；`--remove` 删除它们。该注册指向检出目录，产物重建后由 `pnpm run desktop:install` 重新创建。

### 外壳表面：浏览器交接、页面内标题栏与品牌

子进程带 `--no-open` 运行，web runtime 的默认浏览器交接保持关闭，服务出的页面只出现在窗口内；需要浏览器标签时用 文件 菜单的 在浏览器中打开 把携带启动 token 的原始就绪 URL 交给系统浏览器。窗口无原生边框：`titleBarStyle: 'hidden'` 加注入的页面内顶部条取代原生标题栏与菜单——原生 chrome 无法跟随页面主题、无法缩进标签、会渲染本地化键名（"Ctrl+逗号"）、下拉宽度也不受控。顶部条是页面主题 token 之上的普通 DOM——无需任何原生同步即可跟随 浅色/深色/跟随浏览器——并按编辑器标准的 文件/编辑/选择/查看/窗口/帮助 集合组织，下拉宽度随内容自适应、快捷键列右对齐。侧栏条目通过 CSS-module 词干匹配驱动服务 UI 自己的控件；主进程条目走 preload 桥的唯一 action 通道。所有加速键都在 `before-input-event` 里按物理键映射（缩放来自 `=`/`+`/小键盘，Electron 的 zoomIn role 覆盖不到）——顶部条的快捷键文本纯属显示。产品名是数据不是代码：侧栏品牌与窗口标题都回退到 `brand.localBuild` 文案，侧栏测试钉住该文案。

### 仓库集成

该 app 与 `apps/cli` 一样是 release member（可发布 manifest、加入 workspace 约束门禁的 `files` 策略），以包内捆绑配置加入 host TypeScript face 与 root tsdown workspace，并且不携带 renderer preload：沙箱化的 preload 只支持 CJS，ESM 外壳的占位 preload 只会崩溃而不是占位。`electron` 仅是该 app 的 devDependency；其他 workspace 都不导入它，覆盖率门禁也保持只扫 packages。

## Alternatives considered

- **浏览器 app 模式**（通过 `dsh web --open` 旗标调 `chrome`/`edge --app=<url>`）：零新增依赖，但窗口仍是浏览器的——没有进程所有权（server 可以比窗口活得更久）、没有单实例锁、没有主题联动标题栏，且结果因安装的浏览器而异。保留为手动绕行手段，不是产品路径。
- **Tauri**：产物小且用系统 WebView，但会把 Rust 工具链引入纯 Node 仓库并带来第二套打包故事；因维护成本被否。
- **Electron 走 `file://` 加 IPC fetch 桥**（webserver 头注释预期的更深层形态）：去掉 localhost server，但会分叉传输层——每一条 Connection RPC、WebSocket 下行与信任栅决策都需要 IPC 孪生。推迟到打包产品真正需要时；localhost 形状原样复用浏览器线路。
- **在 Electron 主进程内直接 boot harness**：少一个进程，但把 Electron 生命周期与 Loader 树耦合，并放弃 UI 与 agent 运行时之间的进程隔离——agent 卡死窗口就冻结。子进程形状让文档化的 supervisor 缝隙（`printUrl`）成为两半之间唯一的契约。

## Consequences

web UI 获得了桌面归宿，而产品代码一行未动：主题、设置、会话以及 `pnpm run dev:web` 热更新循环在窗口里与浏览器标签页中表现一致。代价是 Electron 依赖（安装约 100 MB，每个发布列车一次大版本更替）从此由每次 `pnpm install` 支付；且在打包工作内置 runtime 与 web dist 之前，外壳始终绑定仓库检出。

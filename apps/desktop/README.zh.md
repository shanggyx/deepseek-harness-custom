# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

dsh Desktop 是把 dsh 浏览器 UI 装进本地桌面窗口的 Electron 外壳。主进程拉起与浏览器工作流相同的 `dsh web` profile，等待 web runtime 打印的就绪 URL 行，再把服务出的页面装入 `BrowserWindow`。外壳不拥有任何 agent 逻辑，也不新增传输层；一切用户可见行为都仍是 web 表面行为（[`src/main.ts`](src/main.ts)）。

## 在哪里启动

下面所有命令都在**仓库根目录**运行——也就是你 clone 出来的那个目录（里面有根 `package.json`）；外壳的一切路径都以该检出为基准。前置条件：Node ^22.19 或 >=24 与 pnpm（`corepack enable` 或 `npm i -g pnpm`），并在仓库根目录执行过一次 `pnpm install`。

| 你想要 | 命令（仓库根目录） | 行为 |
|---|---|---|
| 开发直启 | `pnpm run desktop` | 先构建 web 前端与外壳，再打开窗口；关窗即全部退出。 |
| 安装成应用 | `pnpm run desktop:install` | 同样的构建，然后把 **dsh** 注册成 Windows 应用（见下）。一次性操作；拉取代码更新后重跑一次。 |
| 卸载 | `pnpm run desktop:uninstall` | 移除两个快捷方式；此外没有安装任何别的东西。 |

## 装好的应用：去哪里找、怎么启动

`pnpm run desktop:install` 会创建两个名为 **dsh** 的快捷方式（品牌蓝底鲸鱼图标）：

- **桌面**：一个 `dsh` 图标——像点击任何 PC 软件一样双击即可。
- **开始菜单**：用户配置文件下的 `Start Menu\Programs\dsh.lnk`。按 **Win+S**（或直接打开开始菜单）输入 `dsh` 就能搜到；它也在 所有应用 → **D** → dsh 里。

两个入口启动的都是与开发直启相同的东西：UI 就绪后出现标题为 **DeepSeek Harness** 的窗口（首次启动会花几秒启动本地服务器；就绪前窗口不显示任何内容）。已有窗口时再次启动只会聚焦现有窗口。关闭窗口会结束本地服务器及其派生的所有进程——没有后台残留，没有托盘图标。

## 和原来的 npm CLI（`npx @deepseek-ai/dsh`）有什么不一样

是同一 UI 之上的两条不同启动路径。`npx @deepseek-ai/dsh web` 运行的是发布的 CLI：它在 `http://127.0.0.1:3080` 起服务，由你自己开浏览器标签页访问，没有任何东西拥有窗口。桌面入口运行的是**本仓库检出**的 Electron 外壳（`apps/desktop`）：外壳从源码拉起 `dsh web` profile、自动挑选空闲端口，并拥有窗口与进程生命周期。由于快捷方式指向检出目录，移动或删除仓库目录会让快捷方式失效，在新位置重跑一次 `pnpm run desktop:install` 即可恢复。

## 行为

| 方面 | 约定 |
|---|---|
| 端口 | 子进程运行 `dsh web --port 0 --no-open`；操作系统挑选空闲端口，外壳从就绪行读取，页面只出现在桌面窗口（需要浏览器标签时用 文件 → 在浏览器中打开）。 |
| 菜单栏 | 编辑器式 文件/编辑/选择/查看/窗口/帮助：新建会话 `Ctrl+N`、打开设置 `Ctrl+,`、缩放 `Ctrl+=` / `Ctrl+-` / `Ctrl+0`、切换侧栏 `Ctrl+B`、重新加载与开发者工具。 |
| 单实例 | 再次启动（快捷方式或命令）只会聚焦已有窗口，不会拉起第二个 dsh 运行时。 |
| 进程树 | 关闭窗口或退出应用会终结子进程的整棵进程树（Windows 上用 `taskkill /T /F`）。 |
| 子进程退出 | dsh 进程自行退出时弹出错误对话框并随窗口关闭外壳。 |
| 窗口几何 | 大小与位置持久化在 Electron userData 目录下的 `window-bounds.json`，加载时按当前显示器重新校验。 |
| 缩放适应 | 三列 web 布局本身已随视口自适应；窗口只补充 `minWidth`/`minHeight`。 |
| 品牌名 | 侧栏名称与窗口标题来自 [`packages/client/locale/src/locales/`](../../packages/client/locale/src/locales/) 中的 `brand.localBuild` 文案。 |

## 环境变量覆盖

| 变量 | 用途 |
|---|---|
| `DSH_DESKTOP_NODE` | 启动 dsh 的 Node 可执行文件（默认：`PATH` 上的 `node`）。 |
| `DSH_DESKTOP_ENTRY` | dsh 启动模块（默认：`apps/cli/src/bin.ts`，即 `pnpm dsh` 的源码入口）。 |

## 背景颜色

窗口自身背景与 web UI 亮色 `bg-base` token 配对，且由于窗口在页面就绪前保持隐藏，它只在首帧前可见；页面加载时应用用户自己的主题。修改 UI 本身的配色应走主题系统而不是这里：调色板与语义 token 在 [`packages/client/ui-theme/src/styles/design-platform.css`](../../packages/client/ui-theme/src/styles/design-platform.css)，运行时主题通过 [`packages/client/ui-theme/src/client/index.ts`](../../packages/client/ui-theme/src/client/index.ts) 的 `ThemeRuntime` 注册。

## 限制

- 外壳与快捷方式依赖仓库检出；打包分发（安装包内置 Node runtime、`lib/` 与 web dist）暂缓。
- 尚无 renderer preload：它将随第一个原生桥一起落地（沙箱化的 preload 只支持 CJS，不是免费的空壳）。
- 应用注册目前仅限 Windows；外壳本身可在任何 Electron 支持的平台运行。

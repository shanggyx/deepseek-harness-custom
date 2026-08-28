# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

dsh Desktop 是把 dsh 浏览器 UI 装进本地桌面窗口的 Electron 外壳。主进程拉起与浏览器工作流相同的 `dsh web` profile，等待 web runtime 打印的就绪 URL 行，再把服务出的页面装入 `BrowserWindow`。外壳不拥有任何 agent 逻辑，也不新增传输层；一切用户可见行为都仍是 web 表面行为（[`src/main.ts`](src/main.ts)）。

## 快速开始

在仓库根目录执行：

```sh
pnpm run desktop
```

该脚本先构建 web 前端，再打包 `lib/main.js` 并启动 Electron。默认从源码运行，需要仓库检出。

## 行为

| 方面 | 约定 |
|---|---|
| 端口 | 子进程运行 `dsh web --port 0`；操作系统挑选空闲端口，外壳从就绪行读取。 |
| 单实例 | 再次启动只会聚焦已有窗口，不会拉起第二个 dsh 运行时。 |
| 进程树 | 关闭窗口或退出应用会终结子进程的整棵进程树（Windows 上用 `taskkill /T /F`）。 |
| 子进程退出 | dsh 进程自行退出时弹出错误对话框并随窗口关闭外壳。 |
| 窗口几何 | 大小与位置持久化在 Electron userData 目录下的 `window-bounds.json`，加载时按当前显示器重新校验。 |
| 缩放适应 | 三列 web 布局本身已随视口自适应；窗口只补充 `minWidth`/`minHeight`。 |
| 缩放 | 标准 View 菜单 role 提供重置/放大/缩小与开发者工具。 |

## 环境变量覆盖

| 变量 | 用途 |
|---|---|
| `DSH_DESKTOP_NODE` | 启动 dsh 的 Node 可执行文件（默认：`PATH` 上的 `node`）。 |
| `DSH_DESKTOP_ENTRY` | dsh 启动模块（默认：`apps/cli/src/bin.ts`，即 `pnpm dsh` 的源码入口）。 |

## 背景颜色

窗口自身背景与 web UI 亮色 `bg-base` token 配对，且由于窗口在页面就绪前保持隐藏，它只在首帧前可见；页面加载时应用用户自己的主题。修改 UI 本身的配色应走主题系统而不是这里：调色板与语义 token 在 [`packages/client/ui-theme/src/styles/design-platform.css`](../../packages/client/ui-theme/src/styles/design-platform.css)，运行时主题通过 [`packages/client/ui-theme/src/client/index.ts`](../../packages/client/ui-theme/src/client/index.ts) 的 `ThemeRuntime` 注册。

## 限制

- 外壳驱动的是仓库检出；打包分发（内置 Node runtime、`lib/` 与 web dist）暂缓。
- 尚无 renderer preload：它将随第一个原生桥一起落地（沙箱化的 preload 只支持 CJS，不是免费的空壳）。

# Agent Note：SSH 终端栈上移 host 平面与可开关的主机清单

Status: implemented

[English](2026-08-29-ssh-host-plane-and-roster-toggle.md) | 中文

## 问题

`terminal-ssh` 此前挂载在 `standard` agent 预设里，这个捷径在三个层面上失败。预设挂载是惰性的——只有第一个会话组合该预设后 standing mount 才存在——因此启动时 `settings.describe` 列不出 `terminal-ssh` 命名空间，健康的部署在「连接」页显示「未启用」。预设行还把一台真实服务器（主机、端口、用户）硬编码进了随仓库发布的组合文件，这是仓库里的用户数据。而且这些顶层服务行没有按该预设文件自己头部的要求放进 `isolate` 组。另一方面，清单 UI 把每台主机渲染成五个裸输入行，与用户要求的一行一主机开关卡片相去甚远；桌面菜单下拉消费 `--dsw-alias-bg-base`，而图片背景模式会把它重绑为半透明色——打开的菜单会透出下面的页面。

## 决策

终端栈上移 host 平面，清单获得真正的开关。

### 组合

`terminals`（`@deepseek-ai/dsh-terminal`）与 `terminal-ssh` 作为行挂进 **base bundle**，紧挨 `subprocess-local`：所有包含 base 的 profile（web、桌面、headless、acp、sdk-app）在启动时即注册服务与 SSH 后端，设置命名空间先于任何会话存在，「连接」页不会再因惰性挂载而「未启用」。`sdk-minimal` 不含 base、保留自己的 `pty` 行，因此不会出现第二个提供方。`standard` 预设甩掉这两行——包括硬编码的主机——只保留 `tool-terminal`，符合该文件自己的规则：注册表属 host 平面，预设只选工具。

### enabled 开关

`SshHostConfig` 增加 `enabled?: boolean`（缺省为启用），贯通 `resolveHosts`、设置 schema 与客户端解码器。启动路径与设置驱动的 rebind 都按它过滤后端注册，停用的主机保留配置但 `ssh:<name>` 无法打开。客户端开关是即时生效：拨动即整份写入，因为需要单独按保存的连接开关不配叫开关。字段编辑仍暂存到 保存 为止。

### 清单 UI

每台主机渲染为一张卡片：开关、主机名叠在其 `user@主机:端口` 行上、启用/停用圆点标记，以及把五个字段展开成网格的编辑控件——是用户指向的形状，不是输入表格。添加动作移到了标题行。

### 下拉表面

桌面菜单下拉改画 `--dsw-alias-bg-layer-2`（设置面板的不透明表面）而非 `bg-base`——图片背景模式会刻意把后者重绑为半透明 color-mix；菜单必须完全盖住身后的页面。

## 曾考虑的替代方案

- **保留预设挂载并强制提前挂载**：掩盖惰性命名空间的症状，却把用户数据留在发布文件里、realm 违规原地不动。
- **放 web-app 而非 base**：只覆盖浏览器 profile；headless 会静默失去 standard 预设承诺的终端工具。
- **为状态点做真实连通性探测**：诚实，但需要新的 Remote 命名空间与探测生命周期；启用/停用标记精确陈述了 harness 已知的事实（后端是否注册）而不假装知道可达性。

## 后果

每个 profile 启动即带终端服务与 SSH 后端；「连接」页首次打开就能列出服务端清单，用户的服务器如今只存在于其设置文档中。预设树少了一处 host 平面违规，发布组合不再包含任何人的服务器。代价：base bundle 的纳入成了产品决策——从部署中移除 SSH 需要显式的 patch 行，而不是丢掉一个预设。

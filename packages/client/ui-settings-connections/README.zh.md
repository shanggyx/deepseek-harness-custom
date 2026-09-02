---
description: "dsh Web 客户端的「连接」设置分区：用户拥有的 SSH 远程主机列表，供 agent 的终端工具连接。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-connections

[English](README.md) | 中文

## 概述

`dsh-client-ui-settings-connections` 是 dsh Web 客户端的「连接」设置页：以可编辑行的形式（名称、主机、端口、用户、密钥路径）渲染 `terminal-ssh` 设置命名空间下用户维护的 SSH 远程主机列表。行编辑先在草稿中暂存，只有保存时才整体写入 Host 文档；部署未组装 `terminal-ssh` 插件时，页面显示不可用提示，而不是一张无法生效的表单。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在设置导航中打开「连接」（地球图标），管理 agent 通过持久终端会话连接的主机。每台主机渲染为一张卡片——启用开关、主机名与其 `user@主机:端口` 行、启用/停用标记，以及展开五个字段的编辑控件。开关即时生效；字段编辑先暂存，**保存**时把整份列表作为一次文档变更写入。部署为只读设置时控件禁用；保存被拒绝时草稿保留在屏幕上并给出失败提示。

停用的主机仍保留配置，但不再注册后端——在重新打开开关前，`ssh:<name>` 无法打开。本页编辑的列表只是用户层：预设或部署组合提供的主机位于另一设置层，这里既不展示也不会覆盖它们。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

本分区向设置外壳注册一个 `settings.section` 条目（`id: connections`，`order: 12`），并通过共享设置作用域绑定 `terminal-ssh` 命名空间。控制器把服务端名单收编进快照仓库，在复制的行上暂存编辑，并把整份列表作为一次 `hosts` set 操作写入；Host 推送会用服务端值重新收编，覆盖任何未保存的草稿。卡片是接收 `{t, state, actions}` 的纯展示组件；分区持有插槽接线与不可用门控。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-settings](../ui-settings/README.zh.md) — 本页面所依赖设置域基础及其作用域服务。
- [terminal-ssh](../../terminal/terminal-ssh/README.zh.md) — 拥有 `terminal-ssh` 命名空间并提供 SSH 终端后端的 Host 插件。

-----

<a id="model-experience"></a>
## 模型体验

无；本包是浏览器侧 UI 插件层，不注册任何模型可见内容。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **列表即全部可编辑面** — 五个行字段之外的主机选项（跳板机、保活间隔、agent 转发）仍留在 `settings.yaml`。
- **无连通性测试** — 本页只暂存与保存配置；可达性由 agent 的终端会话实际观察。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

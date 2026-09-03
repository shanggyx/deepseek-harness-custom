---
description: "SSH PTY 后端：经本地 ssh 客户端的持久远程 shell 会话，每个配置的主机注册一个后端，用户可通过 `terminal-ssh` 设置分区维护。"
kind: "package-reference"
---

# @deepseek-ai/dsh-terminal-ssh

[English](README.md) | 中文

## 概述

`dsh-terminal-ssh` 为每个配置的 SSH 主机注册一个 `ctx.terminals` 后端：打开 `ssh:<name>` 会以本地 `ssh` 客户端连接该主机，并套用与本地 shell 后端相同的持久 `LocalPtySession` 机制。会话按设计就是交互式的——远端横幅、密码提示与远程 shell 全部由所有者的发送驱动，因此密码认证的主机无需存储任何密钥。主机按名称合并自两个层：插件配置与用户维护的 `terminal-ssh` 设置文档（设置层优先），设置变更会原地重注册受影响的后端。

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

base bundle 为所有 profile 挂载本后端：`dsh web`、桌面外壳与 CLI 各 profile 无需额外组合即可提供 SSH 会话；agent 预设只挂载终端工具。终端 Consumer 打开 `ssh:<name>` 与打开本地 `shell` 会话完全一致；发送、就绪与关闭行为都遵循共享的 PTY 契约。

### 主机

一台主机包含 `name`、`host`、`port`（默认 22）、`username`、可选 `identityFile` 与可选 `enabled` 开关（缺省为启用）。两个层按名称合并，设置层胜出：插件 `config.hosts`（部署提供的默认值）与用户的 `terminal-ssh` 设置文档（「连接」设置页编辑的内容）。停用的主机仍保留配置，但不再注册后端——重新打开开关前 `ssh:<name>` 无法打开。重命名主机会以新类型替换其后端；删除主机则注销它。两层中的同名主机只是一个后端——取用户层的值。

### 远程工作区

每台启用的主机同时锚定一个远程工作区：一个真实本地目录，工作区注册表、沙箱与持久化都把它当作普通工作区对待。锚点根目录默认在本用户的系统临时目录（`dsh-remote-workspaces/<名称>`），刻意放在用户目录之外；可通过插件配置 `remoteWorkspaceRoot` 改到任意位置。通过 `workspace.create { sshHost: <名称> }`（选择器的远程主机区由「连接」清单供给）创建工作区会备好锚点目录并注册；在其中创建的会话会收到一条 `ssh:workspace` 运行时上下文子句——与其他提示子句一样随运行时上下文快照落日志——指示 agent 通过 `ssh:<名称>` 终端在远程主机（其登录家目录）上工作，而不是使用本地文件工具。锚点本身始终为空：本地不存储任何项目数据。

### 配置

| 字段 | 默认 | 含义 |
|---|---|---|
| `hosts` | `[]` | 组合提供的主机清单；每项注册一个 `ssh:<name>` 后端 |

会话调优（`rows`、`cols`、回滚上限、就绪时序、`timeoutMs`、`disposeGraceMs`）与 terminal-bash 一致并作用于所有 SSH 会话；生成的[配置目录](../../../docs/config-catalog.zh.md)是每个字段的穷尽来源。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

后端按主机构造 `ssh` argv——端口、可选的显式身份文件（带 `IdentitiesOnly=yes`）、`StrictHostKeyChecking=accept-new`，最后是 `user@host`——并通过子进程终端原语启动，原样复用 `dsh-terminal-bash` 的 `LocalPtySession`。没有启动握手或私有提示标记：远端不受本进程控制，因此每次发送只经共享的静默/超时层落定，回显的远端横幅是启动输出而非就绪证明。对 `terminal-ssh` 命名空间的设置作用域订阅会将服务端名单与已注册后端做差量，只重注册变化的名称。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [终端子系统参考](../../../docs/subsystems/terminal.zh.md) — 本后端实现的服务契约。
- [terminal-bash](../terminal-bash/README.zh.md) — 本包复用其会话机制与就绪模型的本地后端。
- [tool-terminal 工具](../tool-terminal/README.zh.md) — 操作会话的模型侧工具。

-----

<a id="model-experience"></a>
## 模型体验

### 间接消费者

#### 模型看到什么

本包不注册任何提示词或工具。模型可能经由 `@deepseek-ai/dsh-tool-terminal` 或其他 PTY 消费者，收到有界的远端启动输出、发送增量、回滚页、就绪原因与清理错误——包括 ssh 自身的认证提示。

#### Token 影响

保留的 PTY 回滚内容在消费者返回有界输出之前不会进入模型历史。

#### KV Cache 影响

无直接失效；消费者结果保持只追加。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **本地沙箱不覆盖远程主机** — 在 SSH 主机上执行的命令不受任何本地沙箱模式约束；组合应把挂载本后端视为对所配置主机的信任决定。
- **无端口转发或 SCP** — 本后端只打开交互式 shell 会话；文件传输与隧道不在范围内。
- **主机密钥信任为 `accept-new`** — 首次连接信任所出示的密钥；之后密钥变化会让连接失败而不是交互询问。
- **就绪是启发式的** — 没有受控的远程提示标记，发送只经静默与超时层落定。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

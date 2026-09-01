# Agent Note：「连接」设置分区与 SSH 主机清单

Status: implemented

[English](2026-08-29-connections-settings-section.md) | 中文

## 问题

用户维护的 SSH 主机清单此前作为「插件」分区可配置标签页里的一张可折叠卡片交付。这个位置有两层失败。可发现性：远程机器清单在任何用户的心智模型里都不是「某个插件的配置」，而这张卡还埋在通用标签页的多层折叠之下。机制上：可配置标签页按已服务命名空间派发卡片并隐藏未服务的卡片，于是清单只有在组合了 `terminal-ssh` 时才渲染——而且卡片自身带有一个潜在缺陷（它原地修改快照仓库已发布的数组，而仓库在生产外会冻结快照，第二次交互即抛错）；没有任何测试抓到它，因为该卡片的模块导入在断言运行前就让整个包的测试文件崩溃了。

## 决策

SSH 主机获得独立的设置分区：`packages/client/ui-settings-connections`（`@deepseek-ai/dsh-client-ui-settings-connections`）注册一个 `settings.section` 条目（`id: connections`，`order: 12`，位于 Models 与 Plugins 之间），在设置外壳的 `navIcon` 中使用经线地球导航图标。卡片从 `ui-settings-plugins` 中删除——该包回到其测试与 README 早已描述的四张宿主平面插件卡——清单控制器随卡片一并迁出。

### 结构

分区解包一个注入面（`SshHostsCardInjected`），渲染接收 `{t, state, actions}` 的纯展示卡片——自身不带插槽机制，因为今天没有外部插件贡献连接类卡片；item 插槽的间接层等第二种连接类型出现再说。分区以作用域快照的状态门控：已服务的命名空间渲染卡片，已应答但未服务的命名空间渲染不可用提示，进行中的读取短暂渲染空卡片而不是闪出错误答案。

### 命名空间解码

作用域绑定改用域内 `decodeSshHostsDocument` 而非默认的线模式校验：客户端不能依赖拥有 schemastery 信封的 Host 包，而清单的形状（`{hosts?: SshHostRow[]}`）不过是本包已经点名的五个字段。解码器将行规范化（缺失的 `identityFile` 变为 `''`）并拒绝其余一切，损坏的 section 永远到不了卡片。

## 曾考虑的替代方案

- **保留插件标签页内的卡片**：不加新包，但可发现性问题正是用户的原诉，而且「连接」将来会长出非 SSH 条目（分区标题与导语已按清单无关的写法措辞）。
- **一步到位的 `settings.connection.item` 子插槽**：镜像 General 分区的可扩展性，但只有一张卡片时它是没有第二个贡献者的机器——仓库所谓投机性扩展的味道。
- **先原地修卡、以后再挪**：用户侧的原诉原封不动，且插件配置标签页继续收留一个非插件面。

## 后果

插件页甩掉了唯一一张非插件卡；「连接」页拥有清单、其文案词典（`settings.connections`）与未来。冻结缺陷的修复（动作重建清单数组而不是原地修改）由真正运行的控制器规格覆盖，新包的 apply 规格钉住分区 id、顺序、本地化导航标签与折叠清理。该包加入 web-app roster 行、client tsconfig 聚合、生成目录与 client README 表；`terminal-ssh` 补上了初次引入时跳过的包 README——readme 门禁自那以后一直在失败。

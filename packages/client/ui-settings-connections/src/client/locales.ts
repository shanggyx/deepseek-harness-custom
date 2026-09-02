/** Locale bundles for the Connections settings section and its SSH hosts card. */

/** Locale keys these surfaces render. */
export type ConnectionsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'unavailable'
  | 'sshTitle' | 'sshHint' | 'sshAdd'
  | 'sshName' | 'sshHost' | 'sshPort' | 'sshUser' | 'sshIdentity'
  | 'sshRemove' | 'sshEdit' | 'sshSave' | 'sshSaveFailed'
  | 'sshEnabled' | 'sshDisabled'

/** English copy. */
export const en: Record<ConnectionsLocaleKey, string> = {
  nav: 'Connections',
  title: 'Connections',
  intro: 'Manage the remote hosts the agent can reach.',
  unavailable: 'This deployment does not compose the SSH remote terminal.',
  sshTitle: 'SSH remote hosts',
  sshHint: 'The agent reaches enabled hosts through persistent terminal sessions',
  sshAdd: 'Add host',
  sshName: 'Name',
  sshHost: 'Host',
  sshPort: 'Port',
  sshUser: 'User',
  sshIdentity: 'Identity file',
  sshRemove: 'Remove this host',
  sshEdit: 'Edit this host',
  sshSave: 'Save',
  sshSaveFailed: 'The deployment did not accept the roster; your edits are kept for you to correct.',
  sshEnabled: 'Enabled',
  sshDisabled: 'Disabled',
}

/** Simplified Chinese copy. */
export const zh: Record<ConnectionsLocaleKey, string> = {
  nav: '连接',
  title: '连接',
  intro: '管理 agent 可以连接的远程主机。',
  unavailable: '当前部署未启用 SSH 远程终端。',
  sshTitle: 'SSH 远程主机',
  sshHint: 'agent 可通过持久终端会话连接已启用的主机',
  sshAdd: '添加主机',
  sshName: '名称',
  sshHost: '主机',
  sshPort: '端口',
  sshUser: '用户',
  sshIdentity: '密钥路径',
  sshRemove: '删除此主机',
  sshEdit: '编辑此主机',
  sshSave: '保存',
  sshSaveFailed: '部署没有接受这份主机列表，已保留你的修改供更正。',
  sshEnabled: '已启用',
  sshDisabled: '已停用',
}

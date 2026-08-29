/** `settings.theme` namespace dictionaries (the Appearance and font-size rows' copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'fontSize.title': '字号大小',
  'fontSize.description': '仅影响会话内容的字号',
  'fontSize.unit': 'px',
  'fontSize.increase': '增大字号',
  'fontSize.decrease': '减小字号',
  'background.title': '背景',
  'background.description': '用纯色或图片替代默认底色',
  'background.default': '默认',
  'background.color': '纯色',
  'background.image': '图片',
  'background.urlPlaceholder': '图片链接（https://…）',
  'background.urlRequired': '先填写图片链接再调整蒙版',
  'background.dim': '蒙版不透明度',
  'background.local': '选择本地图片…',
  'background.importing': '导入中…',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'fontSize.title': 'Font size',
  'fontSize.description': 'Only affects conversation content',
  'fontSize.unit': 'px',
  'fontSize.increase': 'Increase font size',
  'fontSize.decrease': 'Decrease font size',
  'background.title': 'Background',
  'background.description': 'Replace the default surface with a color or image',
  'background.default': 'Default',
  'background.color': 'Solid color',
  'background.image': 'Image',
  'background.urlPlaceholder': 'Image URL (https://…)',
  'background.urlRequired': 'Fill the image URL before tuning the overlay',
  'background.dim': 'Surface opacity',
  'background.local': 'Use a local image…',
  'background.importing': 'Importing…',
} satisfies Record<ThemeKey, string>

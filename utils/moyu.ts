// Vocabulary: https://developer.nextmoe.dev/specs/moyu-openapi.yaml
const typeLabels: Record<string, string> = {
  manual: '人工翻译',
  ai: 'AI 翻译',
  machine_polishing: '机翻润色',
  machine: '机器翻译',
  save: '存档',
  crack: '破解补丁',
  fix: '修复补丁',
  mod: 'MOD',
  r18: 'R18 补丁',
  decensor: '去码补丁',
  image: '图片补丁',
  other: '其他',
}

const languageLabels: Record<string, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁体中文',
  en: 'English',
  ja: '日本語',
  other: '其他',
}

const platformLabels: Record<string, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
  other: '其他',
}

export const getMoyuTypeLabel = (value: string): string => typeLabels[value] || value
export const getMoyuLanguageLabel = (value: string): string => languageLabels[value] || value
export const getMoyuPlatformLabel = (value: string): string => platformLabels[value] || value

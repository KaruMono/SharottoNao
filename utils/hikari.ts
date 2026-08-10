// Hikari 补丁资源映射表
// 来源: https://github.com/KUN1007/kun-galgame-patch-next/blob/master/constants/resource.ts

export const hikariTypeMap: Record<string, string> = {
  manual: '手动补丁',
  auto: '自动补丁',
  ai: 'AI翻译',
  fix: '修复补丁',
  dlc: 'DLC',
  mod: 'MOD',
  other: '其他',
}

export const hikariLanguageMap: Record<string, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  other: '其他',
}

export const hikariEngineMap: Record<string, string> = {
  krkr: 'KiriKiri',
  renpy: 'RenPy',
  unity: 'Unity',
  rpgmaker: 'RPG Maker',
  nscripter: 'NScripter',
  other: '其他',
}

export const hikariPlatformMap: Record<string, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
  web: 'Web',
  other: '其他',
}

/**
 * 获取补丁类型标签
 */
export function getHikariTypeLabel(type: string): string {
  return hikariTypeMap[type] || type
}

/**
 * 获取补丁语言标签
 */
export function getHikariLanguageLabel(language: string): string {
  return hikariLanguageMap[language] || language
}

/**
 * 获取补丁引擎标签
 */
export function getHikariEngineLabel(engine: string): string {
  return hikariEngineMap[engine] || engine
}

/**
 * 获取补丁平台标签
 */
export function getHikariPlatformLabel(platform: string): string {
  return hikariPlatformMap[platform] || platform
}

/**
 * 构建补丁资源链接
 */
export function buildHikariResourceUrl(patchId: number, resourceId: number): string {
  return `https://www.moyu.moe/patch/${patchId}/resource#kun_patch_resource_${resourceId}`
}

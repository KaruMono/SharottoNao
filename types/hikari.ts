// Hikari API 类型定义
export interface KunUser {
  id: number
  name: string
  avatar: string
}

export interface KunPatchResponse {
  id: number
  name_en_us?: string
  name_zh_cn?: string
  name_ja_jp?: string
  vndb_id: string
  banner: string
  introduction_zh_cn?: string
  introduction_ja_jp?: string
  introduction_en_us?: string
  released: string
  status: number
  download: number
  view: number
  resource_update_time: string
  type: string[]
  language: string[]
  engine: string[]
  platform: string[]
  user_id: number
  user: KunUser
  created: string
  updated: string
  resource: KunPatchResourceResponse[]
}

export interface KunPatchResourceResponse {
  id: number
  storage: 's3' | 'user'
  name: string
  model_name: string
  localization_group_name?: string
  size: string
  code: string
  password: string
  note: string
  hash: string
  type: string[]
  language: string[]
  platform: string[]
  download: number
  status: number
  update_time: string
  user_id: number
  patch_id: number
  created: string
  updated: string
  user: KunUser
}

export interface HikariResponse {
  success: boolean
  message: string
  data: KunPatchResponse | null
}

// NextMoe moyu v2: https://developer.nextmoe.dev/docs/moyu
// Patch, VNDB and catalog IDs belong to separate namespaces and stay strings.
export interface MoyuPublisher {
  object: 'user'
  id: string
  name: string
  avatar_url: string
  web_url: string
}

export interface MoyuResource {
  object: 'patch_resource'
  id: string
  patch_id: string
  name: string
  storage: 's3' | 'user'
  size: string
  hash: string
  model_name: string
  localization_group_name: string
  note: string
  type: string[]
  language: string[]
  platform: string[]
  download_count: number
  like_count: number
  web_url: string
  created_at: string
  updated_at: string
  publisher?: MoyuPublisher
}

export interface MoyuPatch {
  object: 'patch'
  id: string
  vndb_id: string
  catalog_work_id: string | null
  content_limit: 'sfw' | 'nsfw' | null
  release_date: string | null
  type: string[]
  language: string[]
  platform: string[]
  resource_count: number
  download_count: number
  view_count: number
  favorite_count: number
  comment_count: number
  web_url: string
  created_at: string
  updated_at: string
  resource_updated_at: string
  publisher?: MoyuPublisher
  resources?: MoyuResource[]
}

export interface MoyuList<T> {
  object: 'list'
  items: T[]
  next_cursor: string | null
  total: number | null
  missing?: string[]
}

export interface MoyuPatchesResponse {
  status: 'ok' | 'missing_vndb'
  patches: MoyuPatch[]
}

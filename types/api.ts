export type Pagination = {
  page?: number
  limit?: number
  total: number
  totalPages: number
}

export type ListResponse<T> = {
  items: T[]
  pagination: Pagination
}

export type UserSummary = {
  id: number
  username: string
  avatar?: string | null
  bio?: string | null
}

export type GameTitle = {
  titleEn?: string | null
  titleJa?: string | null
  titleZhHans?: string | null
  titleZhHant?: string | null
}

export type GameCardItem = GameTitle & {
  id: number
  title: string
  coverImage?: string | null
  isNsfw?: boolean
  releaseDate?: string | Date | null
  tags?: Array<{ tag: { id: number; name: string; color?: string | null } } | { id?: number; tagId?: number; name?: string; color?: string | null; tag?: { id: number; name: string; color?: string | null } }>
  companies?: Array<{ company: { id: number; name: string }; role?: string } | { companyId?: number; role?: string; name?: string; company?: { id: number; name: string } }>
}

export type CompanyItem = {
  id: number
  name: string
  nameOriginal?: string | null
  logo?: string | null
  foundedYear?: number | null
  website?: string | null
  description?: string | null
  parentId?: number | null
  parent?: { id: number; name: string; logo?: string | null } | null
  aliases?: string[]
  gamesCount?: number
  childrenCount?: number
  children?: Array<{ id: number; name: string; logo?: string | null }>
  games?: GameCardItem[]
  creator?: UserSummary | null
  createdAt?: string | Date
}

export type TagItem = {
  id: number
  name: string
  slug?: string | null
  color?: string | null
  description?: string | null
  isNsfw?: boolean
  gamesCount?: number
}

export type SeriesItem = {
  id: number
  name: string
  nameOriginal?: string | null
  description?: string | null
  coverImage?: string | null
  isNsfw?: boolean
  gamesCount?: number
  createdAt?: string | Date
  _count?: { games: number }
  games?: GameCardItem[]
}

export type EmojiItem = {
  id: number
  name: string
  url: string
  sortOrder?: number
}

export type EmojiPackItem = {
  id: number
  name: string
  description?: string | null
  sortOrder: number
  isActive: boolean
  emojis?: EmojiItem[]
}

export type FriendLinkItem = {
  id: number
  name: string
  url: string
  logo?: string | null
  description?: string | null
  sortOrder: number
}

export type PendingCounts = {
  editRequests: number
  resources: number
  reports: number
  systemErrors: number
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type EditRequestChange = {
  old?: unknown
  new?: unknown
}

export type EditRequestItem = {
  id: number
  gameId: number
  status: ReviewStatus
  createdAt: string | Date
  user?: UserSummary | null
  game?: (GameTitle & { id?: number; title?: string }) | null
  changes?: Record<string, EditRequestChange>
  reviewedBy?: UserSummary | null
  reviewedAt?: string | Date | null
  reviewNote?: string | null
}

export type TagMapEntry = {
  name: string
  color: string | null
  isNsfw: boolean
}

export type EditRequestsResponse = {
  requests: EditRequestItem[]
  totalPages: number
  pendingCount: number
  tagMap?: Record<number, TagMapEntry>
}

export type AdminGameTag = {
  id?: number
  tagId?: number
  name?: string
  color?: string | null
  tag?: { id: number; name: string; color?: string | null }
}

export type AdminGameCompany = {
  companyId?: number
  role?: 'DEVELOPER' | 'PUBLISHER' | string
  name?: string
  company?: { id: number; name: string }
}

export type AdminGameScreenshot = {
  id?: number
  url: string
}

export type AdminGameStaff = {
  id?: number
  role: string
  name?: string
  nameOriginal?: string | null
  characterName?: string | null
  staffId?: number
  staff?: { id: number; name: string; nameOriginal?: string | null }
}

export type AdminGamePurchaseLink = {
  name?: string | null
  url?: string | null
}

export type AdminGameItem = GameCardItem & {
  descriptionEn?: string | null
  descriptionJa?: string | null
  descriptionZhHans?: string | null
  descriptionZhHant?: string | null
  language?: string | null
  companyId?: number | null
  vndbId?: string | null
  bangumiId?: number | string | null
  aliases?: string[]
  screenshots?: AdminGameScreenshot[]
  staff?: AdminGameStaff[]
  tags?: AdminGameTag[]
  companies?: AdminGameCompany[]
  purchaseLinks?: AdminGamePurchaseLink[]
  series?: { id: number; name: string; nameOriginal?: string | null } | null
  company?: { id: number; name: string } | null
  creator?: UserSummary | null
  viewCount?: number
  resourcesCount?: number
  commentsCount?: number
  deletedAt?: string | Date | null
  _count?: Record<string, number>
}

export type ImageItem = {
  id: number
  url: string
  originalName?: string | null
  size: number
  isUsed?: boolean
}

export type IpBlacklistItem = {
  id: number
  ip: string
  reason?: string | null
  createdAt: string | Date
  creator?: UserSummary | null
}

export type OperationLogItem = {
  id: number
  adminId: number
  admin?: UserSummary | null
  action: string
  targetType?: string | null
  targetId?: number | string | null
  content?: string | null
  createdAt: string | Date
}

export type SystemErrorLogItem = {
  id: number
  type: string
  source?: string | null
  message: string
  detail?: string | null
  metadata?: unknown
  isRead: boolean
  createdAt: string | Date
}

export type AdminStatsResponse = {
  stats: {
    totalGames: number
    totalUsers: number
    todayUsers: number
    yesterdayUsers: number
    monthUsers: number
    totalCompanies: number
    totalImages: number
    unusedImages: number
    todayDownloads: number
    todayLogins: number
  }
  recentUsers: Array<UserSummary & { email?: string | null; role: 'ADMIN' | 'EDITOR' | 'USER' | string }>
  recentGames: Array<GameTitle & {
    id: number
    isNsfw?: boolean
    creator?: UserSummary | null
  }>
}

export type QuickImportResult = {
  created: number
  skipped: number
  failed: number
  failedIds: string[]
  skippedIds: string[]
}

export type VndbUpcomingCandidateStatus = 'available' | 'existing' | 'deleted'

export type VndbUpcomingCandidate = {
  vndbId: string
  title: string
  releaseDate: string
  coverImage: string | null
  developers: string[]
  status: VndbUpcomingCandidateStatus
  existingGameId: number | null
}

export type VndbUpcomingResponse = {
  days: number
  startDate: string
  endDate: string
  candidates: VndbUpcomingCandidate[]
}

export type VndbUpcomingPublishResult = QuickImportResult & {
  createdIds: string[]
  items: Array<{
    vndbId: string
    status: 'created' | 'skipped' | 'failed'
    gameId?: number
    message?: string
  }>
}

export type ResourceTypeItem = {
  id: number
  name: string
  icon?: string | null
  sortOrder: number
  resourcesCount?: number
}

export type ResourceReviewLanguage = 'ja' | 'en' | 'zh-Hans' | 'zh-Hant'

export type ResourceReviewItem = {
  id: number
  gameId: number
  title: string
  url: string
  status: ReviewStatus
  extractCode?: string | null
  unzipPassword?: string | null
  remark?: string | null
  language?: ResourceReviewLanguage | string | null
  fileSize?: string | null
  isMachineTranslated?: boolean
  healthStatus?: 'AVAILABLE' | 'NEEDS_REVIEW' | 'SUSPECTED_BAD' | 'UNAVAILABLE' | string
  healthNote?: string | null
  healthCheckedAt?: string | Date | null
  issueCount?: number
  createdAt: string | Date
  type?: Pick<ResourceTypeItem, 'id' | 'name' | 'icon'> | null
  game?: (GameTitle & { id: number; title?: string }) | null
  uploader?: UserSummary | null
}

export type ResourceReviewsResponse = {
  resources: ResourceReviewItem[]
  totalPages: number
  pendingCount: number
}

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'REJECTED'
export type ReportType = 'COMMENT' | 'RESOURCE' | 'GUIDE'

export type ReportItem = {
  id: number
  type: ReportType
  status: ReportStatus
  reason: string
  detail?: string | null
  createdAt: string | Date
  reporter?: UserSummary | null
  handledBy?: UserSummary | null
  handleNote?: string | null
  comment?: {
    id: number
    gameId: number
    content: string
    user?: UserSummary | null
  } | null
  resource?: {
    id: number
    gameId: number
    title: string
    url: string
    healthStatus?: 'AVAILABLE' | 'NEEDS_REVIEW' | 'SUSPECTED_BAD' | 'UNAVAILABLE' | string
    issueCount?: number
    extractCode?: string | null
    unzipPassword?: string | null
    uploader?: UserSummary | null
  } | null
  guide?: {
    id: number
    gameId: number
    title: string
    content: string
    user?: UserSummary | null
  } | null
}

export type ReportsResponse = {
  reports: ReportItem[]
  totalPages: number
}

export type IndexNowSettings = {
  apiKey: string
  autoSubmissionEnabled: boolean
  dailyLimit?: number | null
}

export type IndexNowStats = {
  successCount: number
  failedCount: number
  todayCount: number
  totalCount: number
}

export type IndexNowSubmissionType = 'ADD' | 'UPDATE' | 'DELETE'
export type IndexNowSubmissionStatus = 'SUCCESS' | 'FAILED'

export type IndexNowSubmission = {
  id: number
  url: string
  type: IndexNowSubmissionType
  status: IndexNowSubmissionStatus
  submittedAt: string | Date
  errorMessage?: string | null
}

export type DeleteResult = {
  deleted: number
}

export type AdminUserItem = UserSummary & {
  email: string
  role: 'ADMIN' | 'EDITOR' | 'USER' | string
  status: 'ACTIVE' | 'BANNED' | string
  bio?: string | null
  createdAt: string | Date
  createdGamesCount?: number
  commentsCount?: number
  registrationIp?: string | null
  lastLoginIp?: string | null
  unlimitedDownload?: boolean
}

export type CalendarGameItem = {
  id: number
  title: string
  coverImage: string | null
  isNsfw: boolean
}

export type CalendarGameGroup = {
  date: string
  games: CalendarGameItem[]
}

export type CalendarResponse = {
  games: CalendarGameGroup[]
}

export type GameDetailTag = {
  id: number
  name: string
  slug?: string | null
  color?: string | null
}

export type GameDetailCompany = {
  id?: number
  companyId?: number
  name?: string
  role?: string
  company?: { id: number; name: string }
}

export type GameDetailResource = {
  id: number
  title: string
  url?: string | null
  type?: { id: number; name: string; icon?: string | null } | null
  netDiskType?: { id: number; name: string; icon?: string | null; sortOrder?: number } | null
  uploader?: UserSummary | null
  status?: ReviewStatus | string
  healthStatus?: 'AVAILABLE' | 'NEEDS_REVIEW' | 'SUSPECTED_BAD' | 'UNAVAILABLE' | string
  healthNote?: string | null
  healthCheckedAt?: string | Date | null
  issueCount?: number
  language?: string | null
  platform?: string | null
  fileSize?: string | null
  extractCode?: string | null
  unzipPassword?: string | null
  remark?: string | null
  createdAt: string | Date
  downloadCount?: number
  isMachineTranslated?: boolean
}

export type GameDetailComment = {
  id: number
  content: string
  playTime?: number | null
  likeCount: number
  isLiked?: boolean
  createdAt: string | Date
  user: UserSummary
  replies?: GameDetailComment[]
}

export type GameDetailPurchaseLink = {
  name: string
  url: string
}

export type FavoriteStatus = 'WISHLIST' | 'PLAYING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED'

export type GameDetail = GameTitle & {
  id: number
  title: string
  creatorId?: number | null
  coverImage?: string | null
  isNsfw?: boolean
  avgRating?: number | null
  ratingCount?: number
  userRating?: number | null
  releaseDate?: string | Date | null
  language?: string[]
  aliases?: string[]
  viewCount?: number
  guidesCount?: number
  commentCount?: number
  favoriteStatus?: FavoriteStatus | string | null
  isFavorited?: boolean
  hasBumpedToday?: boolean
  todayBumps?: number
  avgPlayTime?: number | null
  lengthMinutes?: number | null
  description?: string | null
  descriptionEn?: string | null
  descriptionJa?: string | null
  descriptionZhHans?: string | null
  descriptionZhHant?: string | null
  screenshots?: AdminGameScreenshot[]
  tags?: GameDetailTag[]
  companies?: GameDetailCompany[]
  staff?: AdminGameStaff[]
  purchaseLinks?: GameDetailPurchaseLink[]
  series?: { id: number; name: string } | null
  seriesGames?: GameCardItem[]
  relatedGames?: Array<GameCardItem & { company?: { id: number; name: string } | null }>
  resources?: GameDetailResource[]
  comments?: GameDetailComment[]
}

export type GameGuideItem = {
  id: number
  title: string
  content: string
  viewCount: number
  likeCount: number
  isLiked?: boolean
  createdAt: string | Date
  user: UserSummary
}

export type GameGuidesResponse = ListResponse<GameGuideItem>

export type HomeCommentItem = {
  id: number
  content: string
  createdAt: string | Date
  user: UserSummary
  game: Pick<GameCardItem, 'id' | 'title'>
}

export type HomeEditItem = {
  id: number
  action: string
  user: UserSummary
  game: Pick<GameCardItem, 'id' | 'title'>
}

export type TrafficDayItem = {
  date: string
  sizeMb: number
  count: number
  demo?: boolean
}

export type TrafficStatsItem = {
  todayMb: number
  todayCount: number
  week: TrafficDayItem[]
  weekMb: number
  weekCount: number
}

export type HomeResponse = {
  monthlyReleasedGames: GameCardItem[]
  latestGames: GameCardItem[]
  recentlyUpdated: GameCardItem[]
  popularGames: GameCardItem[]
  announcement?: string | null
  tags: TagItem[]
  recentComments: HomeCommentItem[]
  recentEdits: HomeEditItem[]
  friendLinks: FriendLinkItem[]
  traffic?: TrafficStatsItem | null
  homeTitle?: string | null
  siteName?: string | null
  siteDescription?: string | null
  favicon?: string | null
}

export type LeaderboardBreakdown = {
  resources?: number
  createdGames?: number
  editedGames?: number
  guides?: number
  comments?: number
}

export type LeaderboardItem = {
  rank: number
  user: UserSummary
  score: number
  breakdown: LeaderboardBreakdown
}

export type LeaderboardResponse = {
  items: LeaderboardItem[]
}

export type MessageItem = {
  id: number
  type: 'SYSTEM' | 'COMMENT_REPLY' | 'COMMENT_LIKE' | string
  title: string
  content: string
  isRead: boolean
  relatedUrl?: string | null
  createdAt: string | Date
}

export type MessagesResponse = ListResponse<MessageItem> & {
  unreadCount: number
}

export type PrivateMessageType = 'TEXT' | 'IMAGE'

export type PrivateMessageUser = UserSummary & {
  role: UserRole
}

export type PrivateMessageItem = {
  id: number
  conversationId: number
  senderId: number
  receiverId: number
  type: PrivateMessageType
  content?: string | null
  imageUrl?: string | null
  readAt?: string | Date | null
  createdAt: string | Date
}

export type PrivateConversationItem = {
  id: number
  participant: PrivateMessageUser
  lastMessage?: PrivateMessageItem | null
  unreadCount: number
  updatedAt: string | Date
}

export type PrivateConversationsResponse = {
  items: PrivateConversationItem[]
}

export type PrivateConversationMessagesResponse = {
  conversation: {
    id: number
    participant: PrivateMessageUser
    updatedAt: string | Date
  }
  messages: PrivateMessageItem[]
}

export type UserRole = 'ADMIN' | 'EDITOR' | 'USER' | string

export type ProfileStats = {
  followers: number
  following: number
  favorites: number
  createdGames: number
  editedGames: number
  comments: number
}

export type ProfileResponse = UserSummary & {
  email: string
  role: UserRole
  bio?: string | null
  createdAt: string | Date
  emailNotify?: boolean
  twoFactorEnabled?: boolean
  stats: ProfileStats
}

export type UserCommentItem = {
  id: number
  content: string
  playTime?: number | null
  likeCount?: number
  createdAt: string | Date
  game: Pick<GameCardItem, 'id' | 'title' | 'coverImage'>
}

export type UserFavoriteItem = {
  id: number
  status?: FavoriteStatus | string | null
  note?: string | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  statusUpdatedAt?: string | Date | null
  createdAt: string | Date
  game: GameCardItem
}

export type PendingReviewsResponse = {
  editRequests: EditRequestItem[]
  resources: ResourceReviewItem[]
}

export type PublicUserResponse = {
  user: UserSummary & {
    role: UserRole
    bio?: string | null
    createdAt: string | Date
    _count: {
      followers: number
      following: number
      createdGames: number
      favorites: number
      contentEdits: number
      comments: number
      resources: number
      guides: number
    }
  }
  recentFavorites: GameCardItem[]
  recentComments: UserCommentItem[]
  createdGames: GameCardItem[]
}

-- Game 列表/首页/搜索的主过滤+排序路径
CREATE INDEX "Game_deletedAt_isNsfw_createdAt_idx" ON "Game"("deletedAt", "isNsfw", "createdAt");
CREATE INDEX "Game_deletedAt_isNsfw_viewCount_idx" ON "Game"("deletedAt", "isNsfw", "viewCount");
CREATE INDEX "Game_deletedAt_isNsfw_releaseDate_idx" ON "Game"("deletedAt", "isNsfw", "releaseDate");

-- 首页「最新上传」：status + deletedAt 过滤后按 createdAt 排序
CREATE INDEX "Resource_status_deletedAt_createdAt_idx" ON "Resource"("status", "deletedAt", "createdAt");
CREATE INDEX "Resource_gameId_status_deletedAt_idx" ON "Resource"("gameId", "status", "deletedAt");

-- 游戏评论翻页 / 首页最近评论
CREATE INDEX "Comment_gameId_parentId_deletedAt_createdAt_idx" ON "Comment"("gameId", "parentId", "deletedAt", "createdAt");
CREATE INDEX "Comment_deletedAt_parentId_createdAt_idx" ON "Comment"("deletedAt", "parentId", "createdAt");

-- 按日聚合各游戏的顶数
CREATE INDEX "GameBump_bumpDate_gameId_idx" ON "GameBump"("bumpDate", "gameId");

#!/usr/bin/env bash
# Build and activate Charlotte releases without mutating the live .output tree.
set -Eeuo pipefail
umask 027

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_ROOT="${CHARLOTTE_SOURCE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd -P)}"
APP_ROOT="${CHARLOTTE_APP_ROOT:-$SOURCE_ROOT}"
RELEASES_DIR="${CHARLOTTE_RELEASES_DIR:-$APP_ROOT/releases}"
SHARED_DIR="${CHARLOTTE_SHARED_DIR:-$APP_ROOT/shared}"
CURRENT_LINK="${CHARLOTTE_CURRENT_DIR:-$APP_ROOT/current}"
# The legacy runtime normally lives in APP_ROOT. Keep this override for hosts
# where the checked-out source and the directory containing the live .output
# are separate mounts.
LEGACY_ROOT="${CHARLOTTE_LEGACY_ROOT:-$APP_ROOT}"
ENV_FILE="${CHARLOTTE_ENV_FILE:-$SHARED_DIR/.env}"
ECOSYSTEM_FILE="${CHARLOTTE_ECOSYSTEM_FILE:-$SOURCE_ROOT/ecosystem.config.cjs}"
SOURCE_MODE="${CHARLOTTE_SOURCE_MODE:-git}"
APP_NAME="${CHARLOTTE_APP_NAME:-charlotte}"
BASE_PORT="${CHARLOTTE_BASE_PORT:-3000}"
CANDIDATE_PORT="${CHARLOTTE_CANDIDATE_PORT:-}"
if [[ -z "$CANDIDATE_PORT" ]]; then
  [[ "$BASE_PORT" =~ ^[0-9]+$ ]] || { printf '[deploy][error] 正式端口必须是数字\n' >&2; exit 1; }
  CANDIDATE_PORT=$((10#$BASE_PORT + 1))
fi
HEALTH_HOST="${CHARLOTTE_HEALTH_HOST:-127.0.0.1}"
HEALTH_PATH="${CHARLOTTE_HEALTH_PATH:-/api/ready}"
HEALTH_TIMEOUT="${CHARLOTTE_HEALTH_TIMEOUT:-60}"
KEEP_RELEASES="${CHARLOTTE_KEEP_RELEASES:-3}"
ASSET_RETENTION_DAYS="${CHARLOTTE_ASSET_RETENTION_DAYS:-30}"
# Let old PM2 workers finish requests before a future cleanup can remove their
# release. Keep this aligned with ecosystem.config.cjs kill_timeout by default.
DRAIN_SECONDS="${CHARLOTTE_DRAIN_SECONDS:-35}"
RUN_MIGRATIONS="${CHARLOTTE_RUN_MIGRATIONS:-false}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
NODE_BIN="${NODE_BIN:-node}"
PM2_BIN="${PM2_BIN:-pm2}"
CURL_BIN="${CURL_BIN:-curl}"

BUILD_DIR=""
MIGRATION_DIR=""
RELEASE_DIR=""
CANDIDATE_PID=""
PREVIOUS_TARGET=""
SWITCHED=0

log() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy][warn] %s\n' "$*" >&2; }
die() { printf '[deploy][error] %s\n' "$*" >&2; exit 1; }

remove_tree() {
  local target="$1"
  [[ -n "$target" && "$target" != '/' && -d "$target" && ! -L "$target" ]] || die "拒绝删除异常目录: $target"
  find "$target" -xdev -depth -delete
}

# Reject symlinked path components below a managed root. This prevents a
# pre-created `shared/uploads` (or a nested directory inside it) from sending
# migration writes outside the deployment tree.
assert_no_symlink_components() {
  local root="$1" path="$2" cursor="$2"
  [[ "$root" = /* && ( "$path" == "$root" || "$path" == "$root/"* ) ]] \
    || die "路径不在受管目录内: $path"
  while [[ "$cursor" == "$root" || "$cursor" == "$root/"* ]]; do
    [[ ! -L "$cursor" ]] || die "受管路径包含软链接: $cursor"
    [[ "$cursor" == "$root" ]] && break
    cursor="$(dirname -- "$cursor")"
  done
}

validate_internal_symlinks() {
  local root="$1" root_real link raw_target resolved
  root_real="$(readlink -f "$root" 2>/dev/null || true)"
  [[ -n "$root_real" ]] || die "无法解析旧 .output 根目录: $root"
  while IFS= read -r -d '' link; do
    raw_target="$(readlink "$link" 2>/dev/null || true)"
    [[ -n "$raw_target" && "$raw_target" != /* ]] \
      || die "旧 .output 包含绝对或断开的软链接: $link"
    resolved="$(readlink -f "$link" 2>/dev/null || true)"
    [[ -n "$resolved" && "$resolved" == "$root_real/"* ]] \
      || die "旧 .output 包含越界或断开的软链接: $link"
  done < <(find -P "$root" -type l -print0)
}

tree_signature() {
  local root="$1"
  find -P "$root" -type f -printf '%P\0%s\0%T@\0' \
    | sort -z \
    | sha256sum \
    | cut -d' ' -f1
}

usage() {
  cat <<'EOF'
Usage: deployment/deploy-release.sh <command> [release-id]

Commands:
  migrate-existing      One-time migration from root .output/uploads/.env.
  deploy [release-id]   Build and activate a new immutable release.
  rollback <release-id> Preflight and activate an existing release.
  cleanup               Remove releases outside CHARLOTTE_KEEP_RELEASES.
  cleanup-assets        Remove unreferenced old shared _nuxt assets.

Paths are configurable with CHARLOTTE_APP_ROOT, CHARLOTTE_SOURCE_ROOT,
CHARLOTTE_SHARED_DIR, CHARLOTTE_ENV_FILE and CHARLOTTE_LEGACY_ROOT. Git
archives are used by default; set CHARLOTTE_SOURCE_MODE=working-tree to deploy
uncommitted files explicitly.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

validate_integer() {
  local name="$1" value="$2" minimum="${3:-0}"
  [[ "$value" =~ ^[0-9]+$ ]] || die "$name 必须是非负整数，当前为: $value"
  (( value >= minimum )) || die "$name 必须 >= $minimum，当前为: $value"
}

validate_port() {
  validate_integer "$1" "$2" 1
  (( 10#$2 <= 65535 )) || die "$1 超出 TCP 端口范围: $2"
}

validate_paths() {
  [[ -d "$SOURCE_ROOT" ]] || die "源码目录不存在: $SOURCE_ROOT"
  [[ -d "$LEGACY_ROOT" ]] || die "旧运行目录不存在: $LEGACY_ROOT"
  [[ "$APP_ROOT" = /* && "$RELEASES_DIR" = /* && "$SHARED_DIR" = /* ]] \
    || die '部署路径必须使用绝对路径'
  [[ "$APP_ROOT" != '/' && "$RELEASES_DIR" != '/' && "$SHARED_DIR" != '/' ]] \
    || die '不会把文件系统根目录作为部署路径'
  [[ "$CURRENT_LINK" = /* && "$CURRENT_LINK" != '/' ]] || die 'CHARLOTTE_CURRENT_DIR 必须使用绝对路径且不能是根目录'
  [[ "$LEGACY_ROOT" = /* && "$LEGACY_ROOT" != '/' ]] || die 'CHARLOTTE_LEGACY_ROOT 必须使用绝对路径且不能是根目录'
  [[ "$RELEASES_DIR" != "$APP_ROOT" && "$SHARED_DIR" != "$APP_ROOT" ]] \
    || die 'releases/shared 不能直接指向应用根目录'
  [[ "$LEGACY_ROOT" != "$RELEASES_DIR" && "$LEGACY_ROOT" != "$SHARED_DIR" ]] \
    || die 'CHARLOTTE_LEGACY_ROOT 不能指向 releases/shared'
  [[ "$RELEASES_DIR" != "$SHARED_DIR" ]] || die 'releases/shared 不能指向同一目录'
  [[ "$RELEASES_DIR/" != "$SHARED_DIR/"* && "$SHARED_DIR/" != "$RELEASES_DIR/"* ]] \
    || die 'releases/shared 不能互相嵌套'
  [[ "$CURRENT_LINK" != "$RELEASES_DIR/"* && "$CURRENT_LINK" != "$SHARED_DIR/"* ]] \
    || die 'current 不能放在 releases/shared 内部'
  [[ "$BASE_PORT" != "$CANDIDATE_PORT" ]] || die '候选端口不能与正式端口相同'
  validate_port CHARLOTTE_BASE_PORT "$BASE_PORT"
  validate_port CHARLOTTE_CANDIDATE_PORT "$CANDIDATE_PORT"
  validate_integer CHARLOTTE_HEALTH_TIMEOUT "$HEALTH_TIMEOUT" 1
  validate_integer CHARLOTTE_KEEP_RELEASES "$KEEP_RELEASES" 2
  validate_integer CHARLOTTE_ASSET_RETENTION_DAYS "$ASSET_RETENTION_DAYS" 1
  validate_integer CHARLOTTE_DRAIN_SECONDS "$DRAIN_SECONDS" 0
}

# Parse dotenv without eval/source so a password cannot execute shell syntax.
load_env_file() {
  local file="$1" line key value first last
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "${line:0:1}" == '#' ]] && continue
    if [[ "$line" == export\ * ]]; then line="${line#export }"; fi
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "环境变量名非法: $key"
    if (( ${#value} >= 2 )); then
      first="${value:0:1}"
      last="${value: -1}"
      if [[ "$first" == '"' && "$last" == '"' ]] || [[ "$first" == "'" && "$last" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi
    export "$key=$value"
  done < "$file"
}

load_runtime_env() {
  if [[ -f "$ENV_FILE" ]]; then
    load_env_file "$ENV_FILE"
  elif [[ -f "$APP_ROOT/.env" ]]; then
    load_env_file "$APP_ROOT/.env"
  fi
}

# Copy a directory tree without ever overwriting an existing file. This is
# deliberately used for the one-time migration: an accidental second source
# must fail loudly instead of silently replacing uploads or cached assets.
copy_tree_without_overwrite() {
  local source="$1" target="$2" file relative destination temporary symlink
  [[ -d "$source" ]] || return 0
  [[ ! -L "$source" ]] || die "迁移源目录不能是软链接: $source"
  assert_no_symlink_components "$SHARED_DIR" "$target"
  symlink="$(find -P "$source" -type l -print -quit 2>/dev/null || true)"
  [[ -z "$symlink" ]] || die "迁移源目录包含软链接（为避免越界，已停止）: $symlink"
  mkdir -p "$target"

  while IFS= read -r -d '' file; do
    relative="${file#"$source/"}"
    destination="$target/$relative"
    assert_no_symlink_components "$SHARED_DIR" "$destination"
    if [[ -e "$destination" || -L "$destination" ]]; then
      [[ ! -L "$destination" && -f "$destination" ]] \
        || die "迁移目标与文件类型冲突: $destination"
      cmp -s "$file" "$destination" \
        || die "迁移目标已有不同内容，拒绝覆盖: $relative"
      continue
    fi
    mkdir -p "$(dirname -- "$destination")"
    temporary="$(mktemp "${destination}.tmp.XXXXXX")"
    if ! cp -p -- "$file" "$temporary"; then
      rm -f -- "$temporary"
      die "迁移文件失败: $relative"
    fi
    if ! mv -T -- "$temporary" "$destination"; then
      rm -f -- "$temporary"
      die "原子迁移文件失败: $relative"
    fi
  done < <(find -P "$source" -type f -print0)
}

migrate_env_file() {
  local legacy_env="$LEGACY_ROOT/.env" temporary
  if [[ "$ENV_FILE" == "$SHARED_DIR" || "$ENV_FILE" == "$SHARED_DIR/"* ]]; then
    assert_no_symlink_components "$SHARED_DIR" "$ENV_FILE"
  fi
  mkdir -p "$SHARED_DIR"
  if [[ -f "$ENV_FILE" ]]; then
    if [[ -f "$legacy_env" ]] && ! cmp -s "$legacy_env" "$ENV_FILE"; then
      die "shared/.env 已存在且与旧 .env 不同，拒绝覆盖；请确认后手工合并: $ENV_FILE"
    fi
    chmod 600 "$ENV_FILE" || die "无法设置 shared/.env 权限: $ENV_FILE"
    return 0
  fi
  if [[ -f "$legacy_env" ]]; then
    mkdir -p "$(dirname -- "$ENV_FILE")"
    temporary="$(mktemp "$(dirname -- "$ENV_FILE")/.env.tmp.XXXXXX")"
    if ! cp -p -- "$legacy_env" "$temporary"; then
      rm -f -- "$temporary"
      die "复制 .env 失败: $legacy_env"
    fi
    chmod 600 "$temporary" || { rm -f -- "$temporary"; die "无法设置 shared/.env 权限: $ENV_FILE"; }
    if ! mv -T -- "$temporary" "$ENV_FILE"; then
      rm -f -- "$temporary"
      die "原子迁移 .env 失败: $ENV_FILE"
    fi
    log "已迁移环境文件: $ENV_FILE"
  else
    warn "未找到 $legacy_env；后续 deploy 需要通过 shared/.env 或进程环境提供生产配置"
  fi
}

detect_legacy_build_id() {
  local response value endpoint
  if [[ -n "${CHARLOTTE_LEGACY_BUILD_ID:-}" ]]; then
    printf '%s\n' "$CHARLOTTE_LEGACY_BUILD_ID"
    return 0
  fi
  if ! command -v "$CURL_BIN" >/dev/null 2>&1 || ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    return 0
  fi
  for endpoint in /api/build-id /api/health /api/ready; do
    response="$($CURL_BIN --connect-timeout 2 --max-time 5 --silent --show-error \
      "http://${HEALTH_HOST}:${BASE_PORT}${endpoint}" 2>/dev/null || true)"
    [[ -n "$response" ]] || continue
    value="$($NODE_BIN -e '
      try {
        const value = JSON.parse(process.argv[1])
        const id = value && (value.buildId || value.releaseId)
        if (id) process.stdout.write(String(id))
      } catch {}
    ' "$response" 2>/dev/null || true)"
    if [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
      printf '%s\n' "$value"
      return 0
    fi
  done
}

make_legacy_release_id() {
  local candidate="legacy-$(date -u +%Y%m%d%H%M%S)"
  while [[ -e "$RELEASES_DIR/$candidate" || -L "$RELEASES_DIR/$candidate" ]]; do
    candidate="${candidate}-$(printf '%04d' "$RANDOM")"
  done
  printf '%s\n' "$candidate"
}

lock_deploy() {
  mkdir -p "$APP_ROOT" "$RELEASES_DIR" "$SHARED_DIR" "$SHARED_DIR/.charlotte-locks"
  require_command flock
  exec 9>"$APP_ROOT/.deploy.lock"
  flock -n 9 || die '已有另一个部署任务正在运行'
}

source_release() {
  local destination="$1"
  mkdir -p "$destination"
  if [[ "$SOURCE_MODE" == 'git' ]] && git -C "$SOURCE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # A commit archive excludes editor/build output and makes the release
    # reproducible. Set CHARLOTTE_SOURCE_MODE=working-tree only when deploying
    # intentionally uncommitted files.
    git -C "$SOURCE_ROOT" archive --format=tar HEAD \
      | tar --exclude='./.env' --exclude='./.env.*' --exclude='./uploads' -xf - -C "$destination"
    return
  fi
  [[ "$SOURCE_MODE" == 'working-tree' || "$SOURCE_MODE" == 'git' ]] \
    || die "CHARLOTTE_SOURCE_MODE 必须是 git 或 working-tree"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude='/.git/' --exclude='/.output/' --exclude='/.nuxt/' \
      --exclude='/.nitro/' --exclude='/node_modules/' --exclude='/.pnpm-store/' \
      --exclude='/.codex/' --exclude='/.claude/' --exclude='/.cursor/' --exclude='/.kiro/' \
      --exclude='/kun-galgame-forum-master/' \
      --exclude='/releases/' --exclude='/shared/' --exclude='/current' \
      --exclude='/uploads/' --exclude='/.env' --exclude='/.env.*' \
      "$SOURCE_ROOT/" "$destination/"
    return
  fi

  require_command tar
  (
    cd "$SOURCE_ROOT"
    tar --exclude='./.git' --exclude='./.output' --exclude='./.nuxt' \
      --exclude='./.nitro' --exclude='./node_modules' --exclude='./.pnpm-store' \
      --exclude='./.codex' --exclude='./.claude' --exclude='./.cursor' --exclude='./.kiro' \
      --exclude='./kun-galgame-forum-master' --exclude='./releases' \
      --exclude='./shared' --exclude='./current' --exclude='./uploads' \
      --exclude='./.env' --exclude='./.env.*' -cf - .
  ) | tar -xf - -C "$destination"
}

resolve_commit() {
  git -C "$SOURCE_ROOT" rev-parse --short=12 HEAD 2>/dev/null || printf 'nogit'
}

make_release_id() {
  printf '%s-%s' "$(date -u +%Y%m%d%H%M%S)" "$(resolve_commit)"
}

validate_release_id() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "release id 含有非法字符: $1"
}

build_release() {
  local requested_id="${1:-}" release_id="${requested_id:-$(make_release_id)}"
  validate_release_id "$release_id"
  RELEASE_DIR="$RELEASES_DIR/$release_id"
  [[ ! -e "$RELEASE_DIR" && ! -L "$RELEASE_DIR" ]] || die "release 已存在（不会覆盖）: $RELEASE_DIR"

  BUILD_DIR="$(mktemp -d "$RELEASES_DIR/.building-${release_id}.XXXXXX")"
  log "复制源码到临时目录: $BUILD_DIR"
  source_release "$BUILD_DIR"

  # 生产构建不依赖 release 目录里的 git 元数据；版本号写入构建和运行时。
  load_env_file "$ENV_FILE"
  export NODE_ENV=production
  export NUXT_PUBLIC_BUILD_ID="$release_id"
  export CHARLOTTE_RELEASE_ID="$release_id"
  export CHARLOTTE_STATIC_ASSET_ROOT="$SHARED_DIR/nuxt-assets"
  export CHARLOTTE_LOCK_DIR="$SHARED_DIR/.charlotte-locks"
  export CHARLOTTE_REQUIRE_CURRENT=true
  if [[ "${S3_ENABLED:-false}" != 'true' && ( -z "${LOCAL_UPLOAD_PATH:-}" || "${LOCAL_UPLOAD_PATH}" != /* || "${LOCAL_UPLOAD_PATH}" == "$SHARED_DIR/uploads" ) ]]; then
    export LOCAL_UPLOAD_PATH="$SHARED_DIR/uploads"
  fi

  log '安装依赖（frozen lockfile）'
  (cd "$BUILD_DIR" && CI=1 "$PNPM_BIN" install --frozen-lockfile --prod=false)
  log '构建 Nitro/SSR 产物'
  (cd "$BUILD_DIR" && CI=1 "$PNPM_BIN" run build)

  if [[ "$RUN_MIGRATIONS" == 'true' ]]; then
    log '执行 Prisma 生产迁移（CHARLOTTE_RUN_MIGRATIONS=true）'
    (cd "$BUILD_DIR" && "$PNPM_BIN" run db:migrate:deploy)
  fi

  [[ -f "$BUILD_DIR/.output/server/index.mjs" ]] || die '构建完成但缺少 .output/server/index.mjs'
  [[ -d "$BUILD_DIR/.output/public/_nuxt" ]] || die '构建完成但缺少 .output/public/_nuxt'
  printf '%s\n' "$release_id" > "$BUILD_DIR/.release-id"
  printf '%s\n' "$(resolve_commit)" > "$BUILD_DIR/.source-commit"
  find "$BUILD_DIR/.output/public/_nuxt" -type f -printf '%P\n' | sort > "$BUILD_DIR/.nuxt-assets"

  mv -T "$BUILD_DIR" "$RELEASE_DIR"
  BUILD_DIR=""
  log "release 构建完成: $RELEASE_DIR"
}

copy_assets_to_shared() {
  local release="$1" source="$release/.output/public/_nuxt" target="$SHARED_DIR/nuxt-assets/_nuxt" symlink
  [[ -d "$source" ]] || die "release 缺少 Nuxt 静态资源: $source"
  symlink="$(find -P "$source" -type l -print -quit 2>/dev/null || true)"
  [[ -z "$symlink" ]] || die "release 静态资源包含软链接: $symlink"
  assert_no_symlink_components "$SHARED_DIR" "$target"
  mkdir -p "$target"

  # _nuxt 文件名带内容 hash，永远只追加；同名内容不一致直接失败，避免缓存污染。
  while IFS= read -r -d '' file; do
    local relative destination
    relative="${file#"$source/"}"
    destination="$target/$relative"
    assert_no_symlink_components "$SHARED_DIR" "$destination"
    if [[ -e "$destination" || -L "$destination" ]]; then
      [[ ! -L "$destination" ]] || die "共享静态目录包含异常软链接: $destination"
      cmp -s "$file" "$destination" || die "检测到同名 hash 资源内容不一致: $relative"
      continue
    fi
    mkdir -p "$(dirname -- "$destination")"
    # Write outside the public name, then rename atomically so OpenResty never
    # observes a partially copied JS/CSS file.
    local temporary
    temporary="$(mktemp "${destination}.tmp.XXXXXX")"
    if ! cp -p -- "$file" "$temporary"; then
      rm -f -- "$temporary"
      die "复制共享静态资源失败: $relative"
    fi
    if ! mv -T -- "$temporary" "$destination"; then
      rm -f -- "$temporary"
      die "原子发布共享静态资源失败: $relative"
    fi
  done < <(find "$source" -type f -print0)
}

start_candidate() {
  local release="$1" release_id log_file
  release_id="$(cat "$release/.release-id")"
  # Never terminate an unknown process occupying the preflight port. A stale
  # candidate must be investigated explicitly rather than overwritten.
  if "$CURL_BIN" --connect-timeout 1 --max-time 2 --silent \
    "http://${HEALTH_HOST}:${CANDIDATE_PORT}/" >/dev/null 2>&1; then
    die "候选端口已被占用: ${HEALTH_HOST}:${CANDIDATE_PORT}（不会终止未知进程）"
  fi
  log_file="$SHARED_DIR/logs/candidate-${release_id}.log"
  mkdir -p "$SHARED_DIR/logs" "$SHARED_DIR/uploads"
  : > "$log_file"
  log "启动候选版本（端口 $CANDIDATE_PORT）"
  (
    cd "$release"
    export NODE_ENV=production HOST="$HEALTH_HOST" NITRO_HOST="$HEALTH_HOST"
    export PORT="$CANDIDATE_PORT" NITRO_PORT="$CANDIDATE_PORT"
    # 候选进程仅用于预检，不应与线上 PM2 worker 重复执行定时任务。
    export NODE_APP_INSTANCE=1
    export NUXT_PUBLIC_BUILD_ID="$release_id"
    export CHARLOTTE_RELEASE_ID="$release_id"
    export CHARLOTTE_STATIC_ASSET_ROOT="$SHARED_DIR/nuxt-assets"
    export CHARLOTTE_LOCK_DIR="$SHARED_DIR/.charlotte-locks"
    if [[ "${S3_ENABLED:-false}" != 'true' && ( -z "${LOCAL_UPLOAD_PATH:-}" || "${LOCAL_UPLOAD_PATH}" != /* || "${LOCAL_UPLOAD_PATH}" == "$SHARED_DIR/uploads" ) ]]; then
      export LOCAL_UPLOAD_PATH="$SHARED_DIR/uploads"
    fi
    exec "$NODE_BIN" .output/server/index.mjs
  ) >"$log_file" 2>&1 &
  CANDIDATE_PID=$!
}

stop_candidate() {
  local pid="$CANDIDATE_PID"
  [[ -n "$pid" ]] || return 0
  CANDIDATE_PID=""
  kill -0 "$pid" 2>/dev/null || return 0
  kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 35); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done
  warn "候选进程未在 35 秒内退出，发送 SIGKILL: $pid"
  kill -KILL "$pid" 2>/dev/null || true
}

check_home_and_asset() {
  local port="$1" expected="$2" label="$3"
  local html asset_url
  if html="$($CURL_BIN --location --connect-timeout 2 --max-time 8 --fail --silent --show-error \
    --header 'Accept-Encoding: identity' "http://${HEALTH_HOST}:${port}/" 2>/dev/null)"; then
    asset_url="$($NODE_BIN -e '
      const html = process.argv[1]
      const match = html.match(/(?:src|href)="(\/_nuxt\/[^"]+)"/)
      if (match) process.stdout.write(match[1])
    ' "$html" 2>/dev/null || true)"
    if [[ -n "$asset_url" ]] && probe_asset "$port" "$asset_url"; then
      log "$label 健康检查通过（buildId=$expected，已验证 SSR 与 Nuxt 资源）"
      return 0
    fi
  fi
  return 1
}

check_build_id() {
  local port="$1" expected="$2" legacy_mode="$3" response status body
  response="$($CURL_BIN --connect-timeout 2 --max-time 5 --silent --show-error \
    --header 'Cache-Control: no-cache' --write-out $'\n%{http_code}' \
    "http://${HEALTH_HOST}:${port}/api/build-id" 2>/dev/null || true)"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
  # Old baselines can predate this route. A 500 (including a missing lazy
  # Nitro chunk) must still fail even when /api/ready and SSR work.
  [[ "$legacy_mode" == '1' && "$status" == '404' ]] && return 0
  [[ "$status" == '200' ]] || return 1
  "$NODE_BIN" -e '
    try {
      const value = JSON.parse(process.argv[1])
      const expected = process.argv[2]
      const legacy = process.argv[3] === "1"
      if (typeof value.buildId !== "string" || !value.buildId.trim()) process.exit(1)
      if (!legacy && value.buildId !== expected) process.exit(1)
      if (!legacy && value.releaseId !== undefined && value.releaseId !== expected) process.exit(1)
    } catch { process.exit(1) }
  ' "$body" "$expected" "$legacy_mode" >/dev/null 2>&1
}

wait_for_build() {
  local port="$1" expected="$2" label="${3:-版本}" release="${4:-}"
  local url body health_path response status health_checked=0 health_ok=0 legacy_mode=0
  local -a health_paths=("$HEALTH_PATH")
  [[ -f "$release/.legacy-release" ]] && legacy_mode=1
  if [[ "$HEALTH_PATH" == '/api/ready' ]]; then
    health_paths+=('/api/health' '/api/build-id')
  fi
  log "等待 $label 健康检查: http://${HEALTH_HOST}:${port}${HEALTH_PATH}"
  for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
    health_checked=0
    health_ok=0
    for health_path in "${health_paths[@]}"; do
      url="http://${HEALTH_HOST}:${port}${health_path}"
      response="$($CURL_BIN --location --connect-timeout 2 --max-time 5 --silent --show-error \
        --write-out $'\n%{http_code}' "$url" 2>/dev/null || true)"
      status="${response##*$'\n'}"
      body="${response%$'\n'*}"
      # Legacy endpoint fallback is only for a missing route. A 5xx from
      # /api/ready means the database/app is unhealthy and must not be hidden
      # by accepting the lightweight /api/build-id response.
      if [[ "$status" == '404' ]]; then
        continue
      fi
      health_checked=1
      [[ "$status" =~ ^2[0-9][0-9]$ ]] || break
      if "$NODE_BIN" -e '
        try {
          const value = JSON.parse(process.argv[1])
          const expected = process.argv[2]
          const legacy = process.argv[3] === "1"
          if (!legacy && value.buildId !== expected) process.exit(1)
          if (value.status !== undefined && value.status !== "ok") process.exit(1)
          if (value.database !== undefined && value.database !== "ok") process.exit(1)
          if (!legacy && value.releaseId !== undefined && value.releaseId !== expected) process.exit(1)
        } catch { process.exit(1) }
      ' "$body" "$expected" "$legacy_mode" >/dev/null 2>&1; then
        health_ok=1
        break
      fi
    done
    # A baseline copied from an older build may predate all three health
    # endpoints. In that case the SSR page and a referenced asset are still a
    # useful liveness check; a non-404 health failure is never ignored.
    if (( legacy_mode == 1 && health_checked == 0 )); then
      health_ok=1
    fi
    # /api/ready does not import the lazy /api/build-id handler. Probe both so
    # an incomplete server bundle cannot pass readiness and be activated.
    if (( health_ok == 1 )) \
      && check_build_id "$port" "$expected" "$legacy_mode" \
      && check_home_and_asset "$port" "$expected" "$label"; then
      return 0
    fi
    sleep 1
  done
  warn "$label 健康检查失败"
  if [[ -f "$SHARED_DIR/logs/candidate-${expected}.log" ]]; then
    tail -n 80 "$SHARED_DIR/logs/candidate-${expected}.log" >&2 || true
  fi
  return 1
}

probe_asset() {
  local port="$1" asset_url="$2" result status bytes
  result="$($CURL_BIN --location --connect-timeout 2 --max-time 8 --fail --silent --show-error \
    --header 'Accept-Encoding: identity' --output /dev/null --write-out '%{http_code} %{size_download}' \
    "http://${HEALTH_HOST}:${port}${asset_url}" 2>/dev/null || true)"
  read -r status bytes <<<"$result"
  [[ "$status" == '200' && "$bytes" =~ ^[1-9][0-9]*$ ]]
}

check_release_assets() {
  local port="$1" release="$2" file relative
  local -a assets=()
  mapfile -t assets < <(find "$release/.output/public/_nuxt" -type f ! -name '*.br' ! -name '*.gz' | head -n 5)
  ((${#assets[@]} > 0)) || die 'release 没有可验证的未压缩 Nuxt 资源'
  for file in "${assets[@]}"; do
    relative="${file#"$release/.output/public/_nuxt/"}"
    "$CURL_BIN" --location --connect-timeout 2 --max-time 8 --fail --silent --show-error \
      "http://${HEALTH_HOST}:${port}/_nuxt/${relative}" >/dev/null \
      || die "候选版本静态资源检查失败: $relative"
  done
}

current_target() {
  if [[ -L "$CURRENT_LINK" ]]; then
    local target
    target="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
    [[ -d "$target" && -f "$target/.release-id" \
      && -f "$target/.output/server/index.mjs" \
      && -d "$target/.output/public/_nuxt" \
      && "$target" == "$RELEASES_DIR"/* ]] \
      || die "current 软链接无效或指向 releases 之外: $target"
    printf '%s\n' "$target"
  elif [[ -e "$CURRENT_LINK" ]]; then
    die "current 必须是软链接（不会覆盖目录）: $CURRENT_LINK"
  fi
}

migrate_existing() {
  local legacy_output="$LEGACY_ROOT/.output"
  local legacy_uploads="$LEGACY_ROOT/uploads"
  local active legacy_id legacy_build_id temporary legacy_signature_before legacy_signature_after
  local uploads_signature_before uploads_signature_after

  mkdir -p "$RELEASES_DIR" "$SHARED_DIR/uploads" "$SHARED_DIR/nuxt-assets/_nuxt" \
    "$SHARED_DIR/logs" "$SHARED_DIR/.charlotte-locks"
  migrate_env_file

  if [[ -e "$legacy_output" || -L "$legacy_output" ]]; then
    [[ ! -L "$legacy_output" ]] || die "旧 .output 不能是软链接: $legacy_output"
    validate_internal_symlinks "$legacy_output"
  fi

  if [[ -d "$legacy_uploads" ]]; then
    log '迁移本地上传文件（已有同名不同内容时会停止）'
    uploads_signature_before="$(tree_signature "$legacy_uploads")"
    copy_tree_without_overwrite "$legacy_uploads" "$SHARED_DIR/uploads"
    uploads_signature_after="$(tree_signature "$legacy_uploads")"
    [[ "$uploads_signature_before" == "$uploads_signature_after" ]] \
      || die '迁移期间 uploads 发生变化，请暂停上传后重试'
  fi
  if [[ -d "$legacy_output/public/_nuxt" ]]; then
    log '迁移旧 Nuxt 静态资源'
    copy_tree_without_overwrite "$legacy_output/public/_nuxt" "$SHARED_DIR/nuxt-assets/_nuxt"
  fi

  active="$(current_target)"
  if [[ -n "$active" ]]; then
    log "检测到 current 已存在，保留现有 release，不重复创建基线: $active"
    return 0
  fi

  [[ -d "$legacy_output" && -f "$legacy_output/server/index.mjs" ]] \
    || die "未找到可迁移的旧运行产物: $legacy_output"
  [[ -d "$legacy_output/public/_nuxt" ]] \
    || die "旧运行产物缺少 Nuxt 静态资源: $legacy_output/public/_nuxt"

  legacy_id="$(make_legacy_release_id)"
  RELEASE_DIR="$RELEASES_DIR/$legacy_id"
  legacy_signature_before="$(tree_signature "$legacy_output")"
  MIGRATION_DIR="$(mktemp -d "$RELEASES_DIR/.building-${legacy_id}.XXXXXX")"
  log "复制旧 .output 到基线 release: $MIGRATION_DIR"
  if ! cp -a -- "$legacy_output" "$MIGRATION_DIR/.output"; then
    die "复制旧 .output 失败: $legacy_output"
  fi
  legacy_signature_after="$(tree_signature "$legacy_output")"
  [[ "$legacy_signature_before" == "$legacy_signature_after" ]] \
    || die '迁移期间旧 .output 发生变化，请确认没有在线构建后重试'
  validate_internal_symlinks "$legacy_output"
  [[ -f "$MIGRATION_DIR/.output/server/index.mjs" ]] \
    || die '旧 .output 复制后缺少 server/index.mjs'
  [[ -d "$MIGRATION_DIR/.output/public/_nuxt" ]] \
    || die '旧 .output 复制后缺少 public/_nuxt'

  legacy_build_id="$(detect_legacy_build_id || true)"
  [[ "$legacy_build_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || legacy_build_id='unknown'
  printf '%s\n' "$legacy_id" > "$MIGRATION_DIR/.release-id"
  printf '%s\n' 'legacy-existing' > "$MIGRATION_DIR/.source-commit"
  printf '%s\n' "$legacy_build_id" > "$MIGRATION_DIR/.legacy-build-id"
  printf '%s\n' "$legacy_signature_before" > "$MIGRATION_DIR/.legacy-source-signature"
  # The marker lets health checks accept an older build that predates the
  # /api/build-id endpoint while still validating its SSR page and assets.
  printf '%s\n' "$LEGACY_ROOT/.output" > "$MIGRATION_DIR/.legacy-release"
  find "$MIGRATION_DIR/.output/public/_nuxt" -type f -printf '%P\n' | sort \
    > "$MIGRATION_DIR/.nuxt-assets"

  mv -T "$MIGRATION_DIR" "$RELEASE_DIR"
  MIGRATION_DIR=""
  temporary="${CURRENT_LINK}.next.$$"
  [[ ! -e "$temporary" && ! -L "$temporary" ]] || die "current 临时链接已存在: $temporary"
  ln -s "$RELEASE_DIR" "$temporary"
  if ! mv -T "$temporary" "$CURRENT_LINK"; then
    rm -f -- "$temporary"
    die "创建 current 软链接失败: $CURRENT_LINK"
  fi
  log "旧版本基线已建立: $legacy_id（live buildId=${legacy_build_id}）"
  log '迁移不会停止或重载 PM2；下一次 deploy 会在健康检查后接管正式端口'
}

switch_current() {
  local target="$1" temporary="${CURRENT_LINK}.next.$$"
  [[ -d "$target" ]] || die "目标 release 不存在: $target"
  [[ ! -e "$temporary" && ! -L "$temporary" ]] || die "临时链接已存在: $temporary"
  ln -s "$target" "$temporary"
  # 同一文件系统内 rename 是原子的；不会看到半截链接。
  mv -Tf "$temporary" "$CURRENT_LINK"
}

reload_pm2() {
  local release="$1" release_id
  release_id="$(cat "$release/.release-id")"
  export CHARLOTTE_APP_ROOT="$APP_ROOT" CHARLOTTE_CURRENT_DIR="$CURRENT_LINK"
  export CHARLOTTE_ENV_FILE="$ENV_FILE" CHARLOTTE_RELEASE_ID="$release_id"
  export CHARLOTTE_APP_NAME="$APP_NAME"
  export NUXT_PUBLIC_BUILD_ID="$release_id" PORT="$BASE_PORT"
  export CHARLOTTE_STATIC_ASSET_ROOT="$SHARED_DIR/nuxt-assets"
  export CHARLOTTE_LOCK_DIR="$SHARED_DIR/.charlotte-locks"
  export CHARLOTTE_REQUIRE_CURRENT=true
  log '平滑重载 PM2（旧 worker 保留至请求排空）'
  "$PM2_BIN" startOrReload "$ECOSYSTEM_FILE" --only "$APP_NAME" --update-env
  if ! "$PM2_BIN" save >/dev/null 2>&1; then
    warn 'pm2 save 失败，服务仍已重载；请检查 PM2 权限和开机自启配置'
  fi
}

activate_release() {
  local release="$1" release_id
  release_id="$(cat "$release/.release-id")"
  validate_release_id "$release_id"
  PREVIOUS_TARGET="$(current_target)"

  copy_assets_to_shared "$release"
  start_candidate "$release"
  wait_for_build "$CANDIDATE_PORT" "$release_id" '候选版本' "$release" || die '候选版本未通过健康检查，线上链接未改变'
  check_release_assets "$CANDIDATE_PORT" "$release"

  switch_current "$release"
  SWITCHED=1
  reload_pm2 "$release"
  if ! wait_for_build "$BASE_PORT" "$release_id" '正式版本' "$release"; then
    warn '正式版本日志（最近 80 行）：'
    "$PM2_BIN" logs "$APP_NAME" --lines 80 --nostream 2>/dev/null || true
    die '正式端口未通过健康检查，正在回滚 current'
  fi
  stop_candidate
  SWITCHED=0

  [[ "$DRAIN_SECONDS" -eq 0 ]] || sleep "$DRAIN_SECONDS"
  log "已激活 release: $release_id"
}

rollback_current_on_error() {
  local status=$?
  stop_candidate || true
  if (( status != 0 && SWITCHED == 1 )); then
    if [[ -n "$PREVIOUS_TARGET" && -d "$PREVIOUS_TARGET" ]]; then
      warn "部署失败，恢复 current -> $PREVIOUS_TARGET"
      switch_current "$PREVIOUS_TARGET" || warn '恢复 current 失败，请手工检查软链接'
      if command -v "$PM2_BIN" >/dev/null 2>&1; then
        reload_pm2 "$PREVIOUS_TARGET" || warn 'PM2 回滚重载失败，请手工执行 pm2 reload'
      fi
    else
      warn '部署失败且没有可用旧 release；current 将被移除'
      rm -f -- "$CURRENT_LINK" || true
    fi
  fi
  if [[ -n "$BUILD_DIR" && -d "$BUILD_DIR" ]]; then
    remove_tree "$BUILD_DIR"
  fi
  if [[ -n "$MIGRATION_DIR" && -d "$MIGRATION_DIR" ]]; then
    remove_tree "$MIGRATION_DIR"
  fi
  exit "$status"
}

cleanup_releases() {
  local active path count=0 name
  local -a paths=()
  active="$(current_target)"
  mapfile -t paths < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.building-*' -print | sort -r)
  for path in "${paths[@]}"; do
    [[ "$path" == "$active" ]] && continue
    [[ -n "$PREVIOUS_TARGET" && "$path" == "$PREVIOUS_TARGET" ]] && continue
    if (( count < KEEP_RELEASES )); then
      count=$((count + 1))
      continue
    fi
    name="$(basename -- "$path")"
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { warn "跳过异常 release 路径: $path"; continue; }
    log "删除旧 release: $path"
    remove_tree "$path"
  done
}

cleanup_assets() {
  local asset_root="$SHARED_DIR/nuxt-assets/_nuxt" file relative manifest referenced
  local -a manifests=()
  [[ -d "$asset_root" ]] || { log '共享 _nuxt 目录不存在，跳过清理'; return 0; }
  find "$asset_root" -type f -name '*.tmp.*' -mtime +1 -delete 2>/dev/null || true
  mapfile -t manifests < <(find "$RELEASES_DIR" -mindepth 2 -maxdepth 2 -type f -name '.nuxt-assets' -print)
  while IFS= read -r -d '' file; do
    relative="${file#"$asset_root/"}"
    referenced=0
    for manifest in "${manifests[@]}"; do
      if grep -Fxq -- "$relative" "$manifest"; then referenced=1; break; fi
    done
    (( referenced == 1 )) && continue
    log "删除过期且未被 release 引用的资源: $relative"
    rm -f -- "$file"
  done < <(find "$asset_root" -type f -mtime "+$ASSET_RETENTION_DAYS" -print0)
  find "$asset_root" -depth -type d -empty -delete 2>/dev/null || true
}

deploy() {
  build_release "${1:-}"
  activate_release "$RELEASE_DIR"
  cleanup_releases
}

rollback() {
  local release_id="${1:-}"
  [[ -n "$release_id" ]] || die 'rollback 需要 release id'
  validate_release_id "$release_id"
  RELEASE_DIR="$RELEASES_DIR/$release_id"
  [[ ! -L "$RELEASE_DIR" ]] || die "release 不能是软链接: $RELEASE_DIR"
  [[ -f "$RELEASE_DIR/.release-id" && -f "$RELEASE_DIR/.output/server/index.mjs" ]] \
    || die "release 不完整或不存在: $RELEASE_DIR"
  activate_release "$RELEASE_DIR"
}

main() {
  local command="${1:-deploy}"
  if [[ "$command" == '-h' || "$command" == '--help' || "$command" == 'help' ]]; then
    usage
    return 0
  fi
  [[ "$command" == 'migrate-existing' || "$command" == 'deploy' || "$command" == 'rollback' || "$command" == 'cleanup' || "$command" == 'cleanup-assets' ]] || { usage; exit 2; }
  validate_paths
  lock_deploy
  load_runtime_env
  if [[ "$command" == 'deploy' || "$command" == 'rollback' ]]; then
    require_command "$CURL_BIN"
    require_command "$NODE_BIN"
    require_command "$PM2_BIN"
  fi
  if [[ "$command" == 'deploy' ]]; then
    require_command "$PNPM_BIN"
  fi
  if [[ "$command" == 'migrate-existing' ]]; then
    for required in cmp find mktemp cp mv ln readlink sort sha256sum cut; do
      require_command "$required"
    done
  fi
  trap rollback_current_on_error EXIT

  case "$command" in
    migrate-existing) migrate_existing ;;
    deploy) deploy "${2:-}" ;;
    rollback) rollback "${2:-}" ;;
    cleanup) cleanup_releases ;;
    cleanup-assets) cleanup_assets ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

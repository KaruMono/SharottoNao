#!/usr/bin/env bash
# Probe one real Nuxt asset through the public proxy and, optionally, directly
# against PM2. The output is intended for diagnosing stream resets, not for
# replacing the deployment health check.
set -Eeuo pipefail
umask 077

BASE_URL="${1:-}"
ASSET_PATH="${2:-}"
DIRECT_URL="${CHARLOTTE_DIRECT_URL:-}"
CURL_BIN="${CURL_BIN:-curl}"
NODE_BIN="${NODE_BIN:-node}"
TMP_DIR=""
FAILED=0

die() { printf '[http2][error] %s\n' "$*" >&2; exit 2; }
log() { printf '[http2] %s\n' "$*"; }

[[ -n "$BASE_URL" ]] || die "用法: $0 https://example.com [/_nuxt/hash.js]"
[[ "$BASE_URL" =~ ^https?://[^/]+/?$ ]] || die "基础 URL 必须是 http(s)://host"
command -v "$CURL_BIN" >/dev/null 2>&1 || die "缺少 curl: $CURL_BIN"
command -v "$NODE_BIN" >/dev/null 2>&1 || die "缺少 node: $NODE_BIN"
command -v grep >/dev/null 2>&1 || die '缺少 grep'
command -v awk >/dev/null 2>&1 || die '缺少 awk'

BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/charlotte-http2.XXXXXX")"
trap '[[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf -- "$TMP_DIR"' EXIT

with_probe_query() {
  local url="$1" stamp
  stamp="$(date +%s%N 2>/dev/null || date +%s)"
  if [[ "$url" == *\?* ]]; then
    printf '%s&charlotte_probe=%s' "$url" "$stamp"
  else
    printf '%s?charlotte_probe=%s' "$url" "$stamp"
  fi
}

header_value() {
  local file="$1" name="$2"
  awk -F: -v wanted="$name" '
    tolower($1) == tolower(wanted) { value=$0; sub(/^[^:]*:[[:space:]]*/, "", value); sub(/\r$/, "", value) }
    END { if (value != "") print value }
  ' "$file"
}

probe() {
  local label="$1" url="$2" protocol="$3" encoding="${4:-}"
  local header_file="$TMP_DIR/${label//[^A-Za-z0-9_.-]/_}.headers"
  local body_file="$TMP_DIR/${label//[^A-Za-z0-9_.-]/_}.body"
  local error_file="$TMP_DIR/${label//[^A-Za-z0-9_.-]/_}.error"
  local result status bytes version content_length content_encoding build_id
  local -a args=(--silent --show-error --location --connect-timeout 5 --max-time 20
    --header 'Cache-Control: no-cache' --output "$body_file" --dump-header "$header_file"
    --write-out '%{http_code}\t%{size_download}\t%{http_version}\t%{remote_ip}')

  case "$protocol" in
    h1) args+=(--http1.1) ;;
    h2) args+=(--http2) ;;
    *) die "未知协议: $protocol" ;;
  esac
  [[ -n "$encoding" ]] && args+=(--header "Accept-Encoding: $encoding")

  if result="$($CURL_BIN "${args[@]}" "$(with_probe_query "$url")" 2>"$error_file")"; then
    :
  else
    result="${result:-000\t0\t?\t?}"
  fi
  IFS=$'\t' read -r status bytes version _ <<<"$result"
  content_length="$(header_value "$header_file" 'Content-Length')"
  content_encoding="$(header_value "$header_file" 'Content-Encoding')"
  build_id="$(header_value "$header_file" 'X-Charlotte-Build')"

  printf '%-26s status=%-3s bytes=%-8s http=%-3s length=%-8s encoding=%-8s build=%s\n' \
    "$label" "${status:-000}" "${bytes:-0}" "${version:-?}" "${content_length:--}" "${content_encoding:--}" "${build_id:--}"

  if [[ "${status:-000}" != 2* || ! "${bytes:-0}" =~ ^[1-9][0-9]*$ ]]; then
    FAILED=1
    [[ -s "$error_file" ]] && sed 's/^/  curl: /' "$error_file" >&2
    return 0
  fi
  if [[ "$protocol" == h1 && "${version:-}" != 1.1* ]]; then
    log "$label 未按 HTTP/1.1 返回（实际 ${version:-unknown}）"
    FAILED=1
  fi
  if [[ "$protocol" == h2 && "${version:-}" != 2* ]]; then
    log "$label 未按 HTTP/2 返回（实际 ${version:-unknown}）"
    FAILED=1
  fi
  if [[ -n "$content_length" && "$content_length" =~ ^[0-9]+$ && "$content_length" != "$bytes" ]]; then
    log "$label Content-Length 与实际下载字节数不一致"
    FAILED=1
  fi
}

HOME_FILE="$TMP_DIR/home.html"
HOME_HEADERS="$TMP_DIR/home.headers"
HOME_RESULT="$($CURL_BIN --silent --show-error --location --connect-timeout 5 --max-time 20 \
  --header 'Accept-Encoding: identity' --dump-header "$HOME_HEADERS" --output "$HOME_FILE" \
  --write-out '%{http_code}\t%{size_download}\t%{http_version}' "$(with_probe_query "$BASE_URL")" 2>"$TMP_DIR/home.error" || true)"
IFS=$'\t' read -r HOME_STATUS HOME_BYTES HOME_VERSION <<<"$HOME_RESULT"
log "首页 status=${HOME_STATUS:-000} bytes=${HOME_BYTES:-0} http=${HOME_VERSION:-?}"
if [[ "${HOME_STATUS:-000}" != 2* || ! "${HOME_BYTES:-0}" =~ ^[1-9][0-9]*$ ]]; then
  [[ -s "$TMP_DIR/home.error" ]] && sed 's/^/  curl: /' "$TMP_DIR/home.error" >&2
  die '首页请求失败，无法提取 Nuxt 资源'
fi

if [[ -z "$ASSET_PATH" ]]; then
  ASSET_PATH="$($NODE_BIN -e '
    const fs = require("node:fs")
    const html = fs.readFileSync(process.argv[1], "utf8")
    const match = html.match(/(?:src|href)="(\/_nuxt\/[^"]+)"/)
    if (match) process.stdout.write(match[1])
  ' "$HOME_FILE" 2>/dev/null || true)"
fi
[[ -n "$ASSET_PATH" ]] || die '首页没有找到 /_nuxt/ JS/CSS 资源，请手工传入资源路径'
[[ "$ASSET_PATH" == /* ]] || ASSET_PATH="/$ASSET_PATH"
ASSET_URL="$BASE_URL$ASSET_PATH"
log "验证资源: $ASSET_PATH"

probe 'public-h1-identity' "$ASSET_URL" h1 identity
probe 'public-h1-gzip' "$ASSET_URL" h1 gzip
probe 'public-h1-br' "$ASSET_URL" h1 br

if [[ "$BASE_URL" == https://* ]]; then
  if "$CURL_BIN" -V 2>/dev/null | grep -qi 'HTTP2'; then
    probe 'public-h2-identity' "$ASSET_URL" h2 identity
    probe 'public-h2-gzip' "$ASSET_URL" h2 gzip
    probe 'public-h2-br' "$ASSET_URL" h2 br
  else
    log '当前 curl 未编译 HTTP/2 支持，跳过公网 HTTP/2 探测'
  fi
else
  log '基础 URL 不是 HTTPS，跳过公网 HTTP/2（生产 TLS 入口才可用）'
fi

if [[ -n "$DIRECT_URL" ]]; then
  DIRECT_URL="${DIRECT_URL%/}"
  [[ "$DIRECT_URL" =~ ^http://[^/]+(:[0-9]+)?$ ]] || die 'CHARLOTTE_DIRECT_URL 必须是 http://host[:port]'
  probe 'direct-h1-identity' "$DIRECT_URL$ASSET_PATH" h1 identity
fi

if (( FAILED )); then
  die '至少一个探测失败；请结合 OpenResty error.log 中的 upstream/reset/bytes 信息判断代理还是上游'
fi
log '所有已执行探测均通过'

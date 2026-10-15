#!/usr/bin/env bash
# Run with: bash deployment/tests/deploy-health.test.sh
set -Eeuo pipefail

TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source "$TEST_DIR/../deploy-release.sh"

HEALTH_TIMEOUT=1
HEALTH_PATH=/api/ready
CURL_BIN=fixture_curl
NODE_BIN="${NODE_BIN:-node}"
SHARED_DIR="$(mktemp -d)"
trap 'rm -f -- "$SHARED_DIR/.legacy-release"; rmdir -- "$SHARED_DIR"' EXIT

# Exercise the actual readiness loop and JSON validation without starting an
# app, connecting to a database, or modifying a release/PM2 process.
fixture_curl() {
  local url="${!#}"
  case "$url" in
    */api/ready) printf '%s\n%s' "$READY_BODY" "$READY_STATUS" ;;
    */api/health) printf '{}\n404' ;;
    */api/build-id) printf '%s\n%s' "$BUILD_BODY" "$BUILD_STATUS" ;;
    *) return 1 ;;
  esac
}

check_home_and_asset() { SSR_CHECKED=true; }
sleep() { :; }

reset_fixture() {
  READY_STATUS=200
  READY_BODY='{"status":"ok","database":"ok","buildId":"release-new","releaseId":"release-new"}'
  BUILD_STATUS=200
  BUILD_BODY='{"buildId":"release-new","releaseId":"release-new"}'
}

cases=0
assert_health() {
  local expected="$1" label="$2" release="${3:-}" actual
  SSR_CHECKED=false
  if wait_for_build 3001 release-new test "$release" >/dev/null 2>&1; then
    actual=0
  else
    actual=1
  fi
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL: %s (expected exit %s, got %s)\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
  if [[ "$actual" == '0' && "$SSR_CHECKED" != true ]]; then
    printf 'FAIL: %s skipped SSR/resource validation\n' "$label" >&2
    exit 1
  fi
  cases=$((cases + 1))
  printf 'PASS: %s\n' "$label"
}

reset_fixture
assert_health 0 'healthy ready/build-id/SSR'

BUILD_STATUS=500
BUILD_BODY='{"statusCode":500,"message":"ERR_MODULE_NOT_FOUND"}'
assert_health 1 'ready succeeds but build-id chunk is missing'

BUILD_STATUS=404
assert_health 1 'new releases must expose build-id'

reset_fixture
BUILD_BODY='{"buildId":"release-old"}'
assert_health 1 'old worker build ID is rejected'

BUILD_BODY='{"buildId":"release-new","releaseId":"release-old"}'
assert_health 1 'mismatched release ID is rejected'

BUILD_BODY='<html>proxy error</html>'
assert_health 1 'HTML with HTTP 200 is rejected'

BUILD_BODY='{"buildId":""}'
assert_health 1 'empty build ID is rejected'

reset_fixture
READY_STATUS=500
assert_health 1 'healthy build-id cannot hide database failure'

touch "$SHARED_DIR/.legacy-release"
READY_STATUS=404
BUILD_STATUS=404
assert_health 0 'legacy baseline without health routes uses SSR' "$SHARED_DIR"

reset_fixture
READY_BODY='{"status":"ok","buildId":"legacy-original"}'
BUILD_BODY='{"buildId":"legacy-original","releaseId":"legacy-original"}'
assert_health 0 'legacy baseline can retain original build ID' "$SHARED_DIR"

BUILD_STATUS=500
assert_health 1 'legacy baseline cannot hide broken build-id chunk' "$SHARED_DIR"

BUILD_STATUS=404
assert_health 0 'legacy ready route can predate build-id' "$SHARED_DIR"

printf '%s deployment health checks passed\n' "$cases"

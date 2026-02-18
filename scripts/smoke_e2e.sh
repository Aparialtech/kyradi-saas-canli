#!/usr/bin/env bash
set -euo pipefail

# Kyradi SaaS smoke test
# Default mode is read-only. Set SMOKE_MUTATE=true to run transfer create/process flow.

SAAS_BASE_URL="${SAAS_BASE_URL:-https://app.kyradi.com}"
SAAS_API_URL="${SAAS_API_URL:-$SAAS_BASE_URL}"

DEMO_TENANT_ID="${DEMO_TENANT_ID:-7d7417b7-17fe-4857-ab14-dd3f390ec497}"
DEMO_WIDGET_KEY="${DEMO_WIDGET_KEY:-demo-public-key}"

PARTNER_EMAIL="${PARTNER_EMAIL:-}"
PARTNER_PASSWORD="${PARTNER_PASSWORD:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

SMOKE_MUTATE="${SMOKE_MUTATE:-false}"
SMOKE_TRANSFER_AMOUNT="${SMOKE_TRANSFER_AMOUNT:-10.00}"

WORKDIR="$(mktemp -d)"
PARTNER_COOKIE_JAR="$WORKDIR/partner.cookies"
ADMIN_COOKIE_JAR="$WORKDIR/admin.cookies"
trap 'rm -rf "$WORKDIR"' EXIT

PASS_COUNT=0
SKIP_COUNT=0

log() { printf '%s\n' "$*"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); log "PASS: $*"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); log "SKIP: $*"; }
fail() { log "FAIL: $*"; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command missing: $1"
}

need_cmd curl
need_cmd jq

request_expect() {
  local method="$1"
  local url="$2"
  local expected="$3"
  local cookie_jar="${4:-}"
  local data="${5:-}"

  local body_file="$WORKDIR/body.json"
  local status
  local curl_args=(-sS -X "$method" "$url" -H "content-type: application/json" -o "$body_file" -w "%{http_code}")

  if [[ -n "$cookie_jar" ]]; then
    curl_args+=(-b "$cookie_jar" -c "$cookie_jar")
  fi
  if [[ -n "$data" ]]; then
    curl_args+=(-d "$data")
  fi

  status="$(curl "${curl_args[@]}")" || fail "$method $url request failed"

  if [[ "$status" != "$expected" ]]; then
    log "Response body:"
    cat "$body_file" || true
    fail "$method $url expected HTTP $expected got $status"
  fi

  cat "$body_file"
}

extract_first_reservation_id() {
  local payload="$1"
  printf '%s' "$payload" | jq -r '
    if type=="array" then (.[0].id // empty)
    elif type=="object" and .items then (.items[0].id // empty)
    else empty
    end
  '
}

log "Running Kyradi smoke tests against: $SAAS_BASE_URL"

# 1) Public checks
request_expect GET "$SAAS_API_URL/openapi.json" 200 >/dev/null
pass "openapi.json reachable"

request_expect GET "$SAAS_BASE_URL/public/widget/init?tenant_id=$DEMO_TENANT_ID&key=$DEMO_WIDGET_KEY" 200 >/dev/null
pass "public widget init reachable"

# 2) Partner auth checks (optional)
if [[ -n "$PARTNER_EMAIL" && -n "$PARTNER_PASSWORD" ]]; then
  partner_login_payload="$(jq -nc --arg email "$PARTNER_EMAIL" --arg password "$PARTNER_PASSWORD" '{email:$email,password:$password}')"
  request_expect POST "$SAAS_BASE_URL/auth/partner/login" 200 "$PARTNER_COOKIE_JAR" "$partner_login_payload" >/dev/null
  pass "partner login"

  request_expect GET "$SAAS_BASE_URL/auth/me" 200 "$PARTNER_COOKIE_JAR" >/dev/null
  pass "partner auth/me"

  reservations_json="$(request_expect GET "$SAAS_BASE_URL/reservations" 200 "$PARTNER_COOKIE_JAR")"
  pass "partner reservations list"

  request_expect GET "$SAAS_BASE_URL/partners/widget-reservations" 200 "$PARTNER_COOKIE_JAR" >/dev/null
  pass "partner widget reservations list"

  request_expect GET "$SAAS_BASE_URL/payment-schedules/commission-summary" 200 "$PARTNER_COOKIE_JAR" >/dev/null
  pass "partner commission summary"

  request_expect GET "$SAAS_BASE_URL/payment-schedules/transfers" 200 "$PARTNER_COOKIE_JAR" >/dev/null
  pass "partner transfer list"

  first_res_id="$(extract_first_reservation_id "$reservations_json")"
  if [[ -n "$first_res_id" ]]; then
    request_expect GET "$SAAS_BASE_URL/reservations/$first_res_id/payment" 200 "$PARTNER_COOKIE_JAR" >/dev/null
    pass "partner reservation payment status"
  else
    skip "partner reservation payment status (no reservation found)"
  fi
else
  skip "partner flow (set PARTNER_EMAIL and PARTNER_PASSWORD)"
fi

# 3) Admin auth checks (optional)
if [[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
  admin_login_payload="$(jq -nc --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{email:$email,password:$password}')"
  request_expect POST "$SAAS_BASE_URL/auth/admin/login" 200 "$ADMIN_COOKIE_JAR" "$admin_login_payload" >/dev/null
  pass "admin login"

  request_expect GET "$SAAS_BASE_URL/auth/me" 200 "$ADMIN_COOKIE_JAR" >/dev/null
  pass "admin auth/me"

  request_expect GET "$SAAS_BASE_URL/payment-schedules/admin/transfers/all" 200 "$ADMIN_COOKIE_JAR" >/dev/null
  pass "admin transfer list"

  request_expect GET "$SAAS_BASE_URL/payment-schedules/magicpay/status" 200 "$ADMIN_COOKIE_JAR" >/dev/null
  pass "admin gateway status"
else
  skip "admin flow (set ADMIN_EMAIL and ADMIN_PASSWORD)"
fi

# 4) Optional mutation flow: partner request transfer -> admin process transfer
if [[ "$SMOKE_MUTATE" == "true" ]]; then
  if [[ -z "$PARTNER_EMAIL" || -z "$PARTNER_PASSWORD" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    fail "SMOKE_MUTATE=true requires PARTNER_EMAIL, PARTNER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD"
  fi

  transfer_payload="$(jq -nc --arg amount "$SMOKE_TRANSFER_AMOUNT" '{gross_amount: ($amount|tonumber), notes:"smoke_e2e auto test"}')"
  transfer_json="$(request_expect POST "$SAAS_BASE_URL/payment-schedules/transfers/request" 201 "$PARTNER_COOKIE_JAR" "$transfer_payload")"
  transfer_id="$(printf '%s' "$transfer_json" | jq -r '.id // empty')"
  [[ -n "$transfer_id" ]] || fail "failed to parse transfer id"
  pass "partner requested transfer ($transfer_id)"

  request_expect POST "$SAAS_BASE_URL/payment-schedules/transfers/$transfer_id/process-magicpay" 200 "$ADMIN_COOKIE_JAR" >/dev/null
  pass "admin processed transfer via gateway ($transfer_id)"

  check_json="$(request_expect GET "$SAAS_BASE_URL/payment-schedules/admin/transfers/all" 200 "$ADMIN_COOKIE_JAR")"
  final_status="$(printf '%s' "$check_json" | jq -r --arg id "$transfer_id" '.data[] | select(.id==$id) | .status' | head -n 1)"
  [[ "$final_status" == "completed" ]] || fail "transfer $transfer_id expected completed, got '${final_status:-<empty>}'"
  pass "processed transfer status completed ($transfer_id)"
else
  skip "mutation flow disabled (set SMOKE_MUTATE=true to enable)"
fi

log "----------------------------------------"
log "Smoke completed successfully."
log "PASS=$PASS_COUNT SKIP=$SKIP_COUNT"

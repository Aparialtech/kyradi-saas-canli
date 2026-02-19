#!/usr/bin/env bash
set -euo pipefail

hosts=(
  "https://app.kyradi.com"
  "https://admin.kyradi.com"
  "https://demo-hotel.kyradi.com"
)

paths=(
  "/auth/me"
  "/locations"
  "/storages"
  "/reservations"
  "/tickets"
  "/pricing-rules"
  "/reports"
  "/payment-schedules"
  "/ai/assistant"
  "/admin/diagnostics/db"
)

printf "%-35s %-28s %-6s %-40s\n" "HOST" "PATH" "CODE" "LOCATION"
for host in "${hosts[@]}"; do
  for path in "${paths[@]}"; do
    url="${host}${path}"
    status=$(curl -s -o /dev/null -w "%{http_code}" -I "$url")
    location=$(curl -s -I "$url" | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r')
    printf "%-35s %-28s %-6s %-40s\n" "$host" "$path" "$status" "${location:-"-"}"

    if [[ "$status" == "307" || "$status" == "308" ]]; then
      echo "FAIL: redirect $status for $url"
      exit 1
    fi
    if [[ -n "$location" && "$location" == http://* ]]; then
      echo "FAIL: http Location for $url -> $location"
      exit 1
    fi
  done
done

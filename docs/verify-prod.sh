#!/usr/bin/env bash
set -euo pipefail

echo "== Kyradi prod checks =="
echo "Locations (no 307, no Location header expected):"
curl -I https://demo-hotel.kyradi.com/locations | sed -n '1,10p'

echo
echo "Locations (id path):"
curl -I https://demo-hotel.kyradi.com/locations/123 | sed -n '1,10p'

echo
echo "Auth (unauthenticated expected 401, no redirect):"
curl -I https://app.kyradi.com/auth/me | sed -n '1,10p'

echo
echo "Admin diagnostics (unauthenticated expected 401 JSON):"
curl -I https://admin.kyradi.com/admin/diagnostics/db | sed -n '1,10p'

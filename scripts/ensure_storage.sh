#!/bin/zsh
set -euo pipefail

# Ensures at least 1 Location and 1 Storage exists for the authenticated tenant.
#
# Usage (Bearer):
#   SAAS_ORIGIN="https://demo-hotel.kyradi.com" TOKEN="..." ./scripts/ensure_storage.sh
#
# Usage (cookie):
#   SAAS_ORIGIN="https://demo-hotel.kyradi.com" COOKIE="access_token=..." ./scripts/ensure_storage.sh

SAAS_ORIGIN="${SAAS_ORIGIN:-https://demo-hotel.kyradi.com}"
TOKEN="${TOKEN:-}"
COOKIE="${COOKIE:-}"

auth_args=()
if [[ -n "${TOKEN}" ]]; then
  auth_args+=(-H "Authorization: Bearer ${TOKEN}")
elif [[ -n "${COOKIE}" ]]; then
  auth_args+=(--cookie "${COOKIE}")
else
  echo "ERROR: set TOKEN (Bearer) or COOKIE (access_token=...)" >&2
  exit 2
fi

curl_json() {
  local method="$1"
  local path="$2"
  shift 2
  curl -fsS -X "${method}" "${SAAS_ORIGIN}${path}" \
    "${auth_args[@]}" \
    -H "Content-Type: application/json" \
    "$@"
}

echo "== Kyradi ensure_storage"
echo "Origin: ${SAAS_ORIGIN}"

echo ""
echo "== Locations (GET /locations)"
locations_json="$(curl_json GET /locations)"
location_id="$(printf '%s' "${locations_json}" | python3 -c 'import sys,json; data=json.load(sys.stdin); print((data[0].get("id","") if isinstance(data,list) and data else ""))')"

if [[ -z "${location_id}" ]]; then
  echo "No locations found; creating 1 location..."
  create_loc_payload='{"name":"Main Location","address":"-","phone_number":null,"working_hours":null,"lat":null,"lon":null}'
  loc_created="$(curl_json POST /locations -d "${create_loc_payload}")"
  location_id="$(printf '%s' "${loc_created}" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(data.get(\"id\",\"\"))')"
fi

if [[ -z "${location_id}" ]]; then
  echo "ERROR: could not determine location_id" >&2
  exit 1
fi

echo "location_id=${location_id}"

echo ""
echo "== Storages (GET /storages)"
storages_json="$(curl_json GET /storages)"
storage_id="$(printf '%s' "${storages_json}" | python3 -c 'import sys,json; data=json.load(sys.stdin); print((data[0].get("id","") if isinstance(data,list) and data else ""))')"

if [[ -z "${storage_id}" ]]; then
  echo "No storages found; creating 1 storage..."
  create_storage_payload="$(python3 -c 'import json,os; print(json.dumps({\"location_id\": os.environ[\"LOCATION_ID\"],\"code\": None,\"status\": \"idle\",\"capacity\": 10,\"working_hours\": None}, separators=(\",\",\":\"), sort_keys=True))' LOCATION_ID="${location_id}")"
  storage_created="$(curl_json POST /storages -d "${create_storage_payload}")"
  storage_id="$(printf '%s' "${storage_created}" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(data.get(\"id\",\"\"))')"
fi

if [[ -z "${storage_id}" ]]; then
  echo "ERROR: could not determine storage_id" >&2
  exit 1
fi

echo "storage_id=${storage_id}"
echo ""
echo "OK. You can now retry /api/integrations/reservations (it should no longer return no_storage_available)."

# Kyradi SaaS <-> SuperApp Integration Setup (Prod-Safe)

This document describes how to call Kyradi SaaS integration endpoints from SuperApp
and how to validate signature/auth issues without breaking production.

## SaaS URLs

- API (Railway): `https://kyradi-saas-canli-production.up.railway.app`
- Web (Vercel): `https://app.kyradi.com`

Integration endpoints are served from the SaaS API app, but can be reached via the web
host if Vercel rewrites proxy requests (same-origin).

## Required Env (SaaS)

- `SUPERAPP_BASE_URL`
- `SUPERAPP_INTEGRATION_SECRET`
- `INTEGRATION_TIMEOUT_MS` (default `5000`)
- `INTEGRATION_RETRY_COUNT` (default `2`)
- `SUPERAPP_ACCEPT_CANONICAL_SIGNATURES` (default `true`)
  - Aliases: `CANONICAL_SIG`
- Transfer gateway (partner/admin transfer flow):
  - `TRANSFER_GATEWAY_PROVIDER` (default `magicpay`)
  - `TRANSFER_GATEWAY_MODE` (default `demo`, set `live` for real gateway)
  - `TRANSFER_GATEWAY_API_URL` (required in live mode)
  - `TRANSFER_GATEWAY_API_KEY` (required in live mode)
  - `TRANSFER_GATEWAY_API_SECRET` (optional)
  - `TRANSFER_GATEWAY_WEBHOOK_SECRET` (recommended in live mode, callback HMAC)
  - `TRANSFER_GATEWAY_WEBHOOK_TOLERANCE_SECONDS` (default `300`)
  - `TRANSFER_GATEWAY_TIMEOUT_MS` (default `10000`)

## Signature (HMAC)

Header: `x-kyradi-signature`

HMAC algorithm:
- `hex(hmac_sha256(body_bytes, SUPERAPP_INTEGRATION_SECRET))`

SaaS verification is **backward compatible**:
1. HMAC over the **raw request body** (legacy)
2. If enabled, HMAC over **canonical JSON**:
   - UTF-8
   - `JSON.stringify` without whitespace
   - keys sorted (recursively)

This solves signature mismatches caused by JSON key order/whitespace differences.

## Inbound: Create Reservation

Endpoint: `POST /api/integrations/reservations`

Minimal payload:
```json
{
  "externalReservationId": "R-123",
  "paid": true,
  "tenantId": "TENANT_UUID_OR_SLUG",
  "locationId": "LOCATION_UUID"
}
```

Tenant resolution order:
1. `request.state.tenant_id` (host-based resolver)
2. `tenantId` as UUID or slug
3. `tenantSlug`
4. `locationId` -> `Location.tenant_id`

Storage selection:
- prefers `status="idle"` and `capacity>0`
- if `locationId` provided: tries that location first, then tenant-wide

If no storage is selectable, response detail includes:
- `error_code`: `NO_STORAGE_FOR_TENANT` or `NO_IDLE_STORAGE_FOR_TENANT`
- counts: `totalStorages`, `idleStorages`, `occupiedStorages`, `faultyStorages`

## Outbound: SaaS -> SuperApp status update

SaaS posts to:
- `POST ${SUPERAPP_BASE_URL}/integrations/saas/status-update`
Signed with canonical JSON.

## Partner/Admin Transfer Gateway

Existing endpoint path is unchanged:
- `POST /payment-schedules/transfers/{transfer_id}/process-magicpay`

Behavior:
- `TRANSFER_GATEWAY_MODE=demo`: transfer is processed by demo adapter (safe simulation)
- `TRANSFER_GATEWAY_MODE=live`: same endpoint calls external gateway API
  - request target: `${TRANSFER_GATEWAY_API_URL}/transfers`
  - payload includes: `transferId`, `tenantId`, `amount`, `currency`, `recipientIban`, `recipientName`

Status endpoint:
- `GET /payment-schedules/magicpay/status`
  - reports demo/live mode and configuration state.

Gateway callback endpoint (new, backward-compatible):
- `POST /payment-schedules/transfers/callback`
  - headers: `x-transfer-signature` (or `x-kyradi-signature`), optional `x-transfer-timestamp`
  - body: `{ "transferId": "...", "status": "completed|failed|processing", "referenceId": "...", "transactionId": "..." }`
  - idempotent: duplicate callbacks for terminal transfers return `idempotent=true` and do not rewrite state.

## Quick Local Signing (curl)

Example with **raw-body signature** (make sure the body string is exactly the same bytes):

```bash
SAAS_ORIGIN="https://kyradi-saas-canli-production.up.railway.app"
SECRET="YOUR_SUPERAPP_INTEGRATION_SECRET"
BODY='{"externalReservationId":"R-test","paid":true,"tenantId":"demo-hotel","locationId":"LOCATION_UUID"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -i -X POST "$SAAS_ORIGIN/api/integrations/reservations" \\
  -H "content-type: application/json" \\
  -H "x-kyradi-signature: $SIG" \\
  -d "$BODY"
```

Expected:
- `201 Created` on success
- `401 Invalid signature` if `SIG` is wrong (this is expected behavior)

## Debug Checklist

1. If you see `Invalid signature`:
   - Confirm secret matches on both sides
   - Confirm raw body bytes match, or switch the client to canonical JSON signing
2. If you see `tenant_id_required`:
   - Send `tenantId` (UUID or slug) or `tenantSlug`, or `locationId`
3. If you see `NO_IDLE_STORAGE_FOR_TENANT`:
   - Ensure tenant has at least 1 storage with `status=idle` and `capacity>0`

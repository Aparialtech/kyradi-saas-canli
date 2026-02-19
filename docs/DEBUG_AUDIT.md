# Kyradi Prod Debug Audit

## Scope
Multi-host frontend (Vercel) + backend (Railway) with tenant subdomains.
Goal: stabilize same-origin API flow and eliminate redirects/CSP blocks.

## Findings (evidence-based)
1) **CSP blocks requests** when browser follows a 307 redirect to
   `http://kyradi-saas-canli-production.up.railway.app/...`.
   - This happens when API routes are redirected (trailing slash or proxy scheme).
2) **Mixed origins** or HTTP scheme create auth/cookie instability and CSP failures.
3) **Rewrite coverage gaps** (e.g. `/locations` without `:path*`) caused redirects.

## Fixes Applied
- Force API to **same-origin** in prod (frontend `env.ts` and axios base).
- Vercel rewrites now cover both **root path and `:path*`** for core APIs:
  `/locations`, `/storages`, `/reservations`, `/tickets`, `/pricing-rules`, `/ai`, etc.
- FastAPI router redirect slashes disabled and **proxy headers trusted**
  to avoid scheme/host confusion behind Vercel/Railway.

## Architecture (Final)
- Frontend calls **relative paths** (same-origin).
- Vercel rewrites proxy API paths to Railway.
- Cookies remain HttpOnly/Secure, and auth uses same-origin requests.
- CSP stays strict; no HTTP origins allowed.

## Known Safe Behaviors
- HEAD may return 405 for GET-only endpoints (expected).
- Authenticated GET should return 200, unauthenticated returns 401.


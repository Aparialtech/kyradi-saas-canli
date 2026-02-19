#!/usr/bin/env python3
"""Decode a JWT payload locally (no signature verification).

Usage:
  python scripts/jwt_decode.py "$TOKEN"
"""

from __future__ import annotations

import base64
import json
import sys


def _b64url_decode(s: str) -> bytes:
    s = s.strip()
    pad = "=" * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode(s + pad)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: jwt_decode.py <token>", file=sys.stderr)
        return 2
    token = sys.argv[1].strip()
    parts = token.split(".")
    if len(parts) < 2:
        print("invalid token (expected header.payload.signature)", file=sys.stderr)
        return 2

    header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
    payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
    print(json.dumps({"header": header, "payload": payload}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


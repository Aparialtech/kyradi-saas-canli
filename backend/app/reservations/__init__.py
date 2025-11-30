"""Shim to expose top-level reservations package under app namespace."""

from __future__ import annotations

import sys
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:  # pragma: no cover
    sys.path.append(str(ROOT_DIR))

_reservations_module: ModuleType = import_module("reservations")

# Re-export submodules (models, routers, etc.)
for sub in ("models", "router_public", "router_private", "router_admin", "services", "availability"):
    try:
        module = import_module(f"reservations.{sub}")
        sys.modules[f"{__name__}.{sub}"] = module
    except ModuleNotFoundError:  # pragma: no cover
        continue


def __getattr__(name: str) -> Any:  # pragma: no cover
    return getattr(_reservations_module, name)


def __dir__() -> list[str]:  # pragma: no cover
    return sorted(set(dir(_reservations_module)))

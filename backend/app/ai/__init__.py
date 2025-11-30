"""Shim module exposing the top-level AI package under app.* namespace."""

from __future__ import annotations

import sys
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:  # pragma: no cover - environment specific
    sys.path.append(str(ROOT_DIR))

_ai_module: ModuleType = import_module("ai")


def __getattr__(name: str) -> Any:  # pragma: no cover - thin wrapper
    return getattr(_ai_module, name)


def __dir__() -> list[str]:  # pragma: no cover - thin wrapper
    return sorted(set(dir(_ai_module)))

from urllib.parse import urlparse


def sanitize_redirect_url(value: str | None, default_path: str = "/app") -> str:
    if not value:
        return default_path

    trimmed = value.strip()
    if not trimmed:
        return default_path

    if trimmed.startswith("//"):
        return default_path

    if trimmed.startswith("/"):
        return trimmed

    parsed = urlparse(trimmed)
    if parsed.scheme not in {"http", "https"}:
        return default_path

    host = (parsed.hostname or "").lower()
    if host == "kyradi.com" or host.endswith(".kyradi.com"):
        return trimmed

    return default_path

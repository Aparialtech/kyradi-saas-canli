import ipaddress
import re
import unicodedata


class DomainValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


RESERVED_SLUGS = {
    "admin", "app", "www", "api", "mail", "smtp", "ftp", "cdn",
    "support", "help", "docs", "status", "blog", "news",
    "billing", "payment", "payments", "checkout", "auth",
    "login", "signup", "register", "dashboard", "panel",
    "kyradi", "otel", "hotel", "test", "demo", "staging", "dev",
    "assets", "static", "images", "img", "css", "js", "fonts",
}


def normalize_and_validate_slug(value: str) -> str:
    if value is None:
        raise DomainValidationError("slug_missing", "Subdomain en az 3 karakter olmalıdır.")

    normalized_slug = value.strip().lower()

    turkish_to_english = {
        "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
        "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
    }
    for turkish, english in turkish_to_english.items():
        normalized_slug = normalized_slug.replace(turkish, english)

    normalized_slug = unicodedata.normalize("NFKD", normalized_slug)
    normalized_slug = "".join(c for c in normalized_slug if not unicodedata.combining(c))
    normalized_slug = re.sub(r"[\s_]+", "-", normalized_slug)
    normalized_slug = re.sub(r"-+", "-", normalized_slug)
    normalized_slug = re.sub(r"[^a-z0-9_-]", "", normalized_slug)
    normalized_slug = normalized_slug.strip("-_")

    if not normalized_slug or len(normalized_slug) < 3:
        raise DomainValidationError("slug_too_short", "Subdomain en az 3 karakter olmalıdır.")

    if len(normalized_slug) > 50:
        raise DomainValidationError("slug_too_long", "Subdomain en fazla 50 karakter olabilir.")

    if not re.match(r"^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$", normalized_slug):
        raise DomainValidationError("slug_invalid_format", "Subdomain alfanümerik karakterlerle başlamalı ve bitmelidir.")

    if normalized_slug in RESERVED_SLUGS:
        raise DomainValidationError(
            "slug_reserved",
            f"'{normalized_slug}' subdomain'i sistem tarafından rezerve edilmiştir. Lütfen başka bir subdomain seçin.",
        )

    return normalized_slug


def normalize_and_validate_custom_domain(value: str) -> str:
    if value is None:
        raise DomainValidationError(
            "custom_domain_invalid",
            "Custom domain örneği: panel.oteliniz.com (http/https ve / kullanmayın)",
        )

    custom_domain = value.strip().lower()
    invalid_custom_domain_message = "Custom domain örneği: panel.oteliniz.com (http/https ve / kullanmayın)"
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
    blocked_suffixes = (".local", ".internal", ".lan")

    if custom_domain.startswith("http://") or custom_domain.startswith("https://"):
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    if "/" in custom_domain or "?" in custom_domain:
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    if custom_domain in blocked_hosts or custom_domain.endswith(blocked_suffixes):
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    try:
        ipaddress.ip_address(custom_domain)
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)
    except ValueError:
        pass

    if "." not in custom_domain:
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    if custom_domain == "kyradi.com" or custom_domain.endswith(".kyradi.com"):
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    if not re.match(r"^[a-z0-9.-]+$", custom_domain):
        raise DomainValidationError("custom_domain_invalid", invalid_custom_domain_message)

    return custom_domain

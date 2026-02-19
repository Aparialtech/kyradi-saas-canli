from app.utils.safe_redirect import sanitize_redirect_url


def test_sanitize_redirect_blocks_lookalike_domain():
    assert sanitize_redirect_url("https://evil-kyradi.com") == "/app"


def test_sanitize_redirect_blocks_protocol_relative():
    assert sanitize_redirect_url("//evil.com") == "/app"


def test_sanitize_redirect_accepts_relative():
    assert sanitize_redirect_url("/app/users") == "/app/users"


def test_sanitize_redirect_accepts_subdomain():
    assert sanitize_redirect_url("https://x.kyradi.com/app") == "https://x.kyradi.com/app"

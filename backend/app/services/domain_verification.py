import logging
from typing import Tuple

import httpx

from app.models import Tenant

logger = logging.getLogger(__name__)

VERIFY_PATH = "/.well-known/kyradi-domain-check"


async def verify_custom_domain(tenant: Tenant) -> Tuple[bool, str]:
    if not tenant.custom_domain:
        return False, "Custom domain tanımlı değil."

    url = f"https://{tenant.custom_domain}{VERIFY_PATH}"

    user_message = "Domain doğrulanamadı. DNS yayılımı tamamlanmamış olabilir. 10 dk sonra tekrar deneyin."

    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.warning("Domain verify request failed for %s: %s", tenant.custom_domain, exc)
        return False, user_message
    except ValueError:
        logger.warning("Domain verify invalid JSON for %s", tenant.custom_domain)
        return False, user_message

    if isinstance(data, dict) and data.get("ok") is True and data.get("service") == "kyradi":
        return True, ""

    logger.warning("Domain verify mismatch for %s: %s", tenant.custom_domain, data)
    return False, user_message

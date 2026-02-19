"""KYRADİ backend package."""

import sys

# Avoid duplicate package loading when imported as "backend.app" and "app".
sys.modules.setdefault("app", sys.modules[__name__])

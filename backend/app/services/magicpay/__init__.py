"""MagicPay payment gateway integration."""

from .client import MagicPayClient, FakeMagicPayClient, RealMagicPayClient, get_magicpay_client
from .service import MagicPayService

__all__ = [
    "MagicPayClient",
    "FakeMagicPayClient",
    "RealMagicPayClient",
    "get_magicpay_client",
    "MagicPayService",
]


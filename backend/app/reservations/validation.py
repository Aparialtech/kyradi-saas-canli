"""Validation utilities for reservation data."""

import re
from typing import Optional


def validate_tckn(tc_identity_number: Optional[str]) -> tuple[bool, Optional[str]]:
    """
    Validate Turkish National ID (TCKN).
    
    Basic structural validation:
    - Must be exactly 11 digits
    - First digit cannot be 0
    - Last digit is checksum
    
    Returns: (is_valid, error_message)
    """
    if not tc_identity_number:
        return True, None  # Optional field
    
    tc_identity = tc_identity_number.strip()
    
    # Must be exactly 11 digits
    if len(tc_identity) != 11:
        return False, "TC Kimlik No tam olarak 11 haneli olmalıdır"
    
    if not tc_identity.isdigit():
        return False, "TC Kimlik No sadece rakamlardan oluşmalıdır"
    
    # First digit cannot be 0
    if tc_identity[0] == "0":
        return False, "TC Kimlik No ilk hanesi 0 olamaz"
    
    # Basic checksum validation (simplified)
    digits = [int(d) for d in tc_identity]
    sum_odd = sum(digits[i] for i in range(0, 9, 2))
    sum_even = sum(digits[i] for i in range(1, 9, 2))
    
    check1 = (sum_odd * 7 - sum_even) % 10
    if check1 != digits[9]:
        return False, "TC Kimlik No geçersiz (kontrol hanesi hatalı)"
    
    check2 = (sum_odd + sum_even + digits[9]) % 10
    if check2 != digits[10]:
        return False, "TC Kimlik No geçersiz (kontrol hanesi hatalı)"
    
    return True, None


def mask_tckn(tc_identity_number: Optional[str]) -> str:
    """Mask TCKN for logging - only show last 2 digits."""
    if not tc_identity_number:
        return "N/A"
    if len(tc_identity_number) < 2:
        return "****"
    return f"****{tc_identity_number[-2:]}"


def validate_phone(phone: Optional[str]) -> tuple[bool, Optional[str]]:
    """Validate phone number - basic check for min 10 digits."""
    if not phone:
        return False, "Telefon numarası zorunlu"
    
    # Remove common formatting characters
    clean_phone = re.sub(r'[\s\-\(\)\+]', '', phone)
    
    # Check if it's mostly digits
    if not re.match(r'^[\d]+$', clean_phone):
        return False, "Telefon numarası geçersiz format"
    
    if len(clean_phone) < 10:
        return False, "Telefon numarası en az 10 haneli olmalıdır"
    
    return True, None


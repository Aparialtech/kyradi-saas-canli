"""Schemas for legal text endpoints."""

from pydantic import BaseModel


class LegalTextsResponse(BaseModel):
    kvkk_text: str
    aydinlatma_text: str
    terms_text: str


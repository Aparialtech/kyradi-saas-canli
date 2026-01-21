"""Domain check endpoint for custom domain verification."""

from fastapi import APIRouter, Request, HTTPException, status

router = APIRouter()


@router.get("/.well-known/kyradi-domain-check")
async def domain_check(request: Request) -> dict:
    tenant = getattr(request.state, "tenant", None)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    return {
        "ok": True,
        "service": "kyradi",
    }

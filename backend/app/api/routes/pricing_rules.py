"""Backward-compatible alias routes for pricing rules.

Some clients historically used `/pricing-rules/*` while the canonical endpoints
live under `/pricing/*`. These routes delegate to the canonical handlers to
avoid any behavior drift.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin, require_tenant_operator
from ...models import User
from ...schemas.pricing import PricingRuleCreate, PricingRuleRead, PricingRuleUpdate

from .pricing import (
    PriceEstimateRequest,
    PriceEstimateResponse,
    estimate_price as _estimate_price,
    list_pricing_rules as _list_pricing_rules,
    create_pricing_rule as _create_pricing_rule,
    get_pricing_rule as _get_pricing_rule,
    update_pricing_rule as _update_pricing_rule,
    delete_pricing_rule as _delete_pricing_rule,
)

router = APIRouter(prefix="/pricing-rules", tags=["pricing"])


@router.post("/estimate", response_model=PriceEstimateResponse)
@router.post("/estimate/", response_model=PriceEstimateResponse)
async def estimate_price_alias(
    payload: PriceEstimateRequest,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PriceEstimateResponse:
    return await _estimate_price(payload=payload, current_user=current_user, session=session)


@router.get("", response_model=List[PricingRuleRead])
@router.get("/", response_model=List[PricingRuleRead])
async def list_pricing_rules_alias(
    scope: Optional[str] = Query(None, description="Filter by scope: GLOBAL, TENANT, LOCATION, STORAGE"),
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[PricingRuleRead]:
    return await _list_pricing_rules(scope=scope, current_user=current_user, session=session)


@router.post("", response_model=PricingRuleRead, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PricingRuleRead, status_code=status.HTTP_201_CREATED)
async def create_pricing_rule_alias(
    payload: PricingRuleCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    return await _create_pricing_rule(payload=payload, current_user=current_user, session=session)


@router.get("/{rule_id}", response_model=PricingRuleRead)
async def get_pricing_rule_alias(
    rule_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    return await _get_pricing_rule(rule_id=rule_id, current_user=current_user, session=session)


@router.patch("/{rule_id}", response_model=PricingRuleRead)
async def update_pricing_rule_alias(
    rule_id: str,
    payload: PricingRuleUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    return await _update_pricing_rule(rule_id=rule_id, payload=payload, current_user=current_user, session=session)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_rule_alias(
    rule_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    return await _delete_pricing_rule(rule_id=rule_id, current_user=current_user, session=session)

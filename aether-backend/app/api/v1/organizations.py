import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.database import supabase
from app.schemas.auth import CurrentUser

logger = logging.getLogger("app.organizations")

router = APIRouter()

PROFILE_FIELDS_BASE = "name, nip, address"
PROFILE_FIELDS_WITH_PHONE = f"{PROFILE_FIELDS_BASE}, phone"
SUBSCRIPTION_FIELDS = f"{PROFILE_FIELDS_BASE}, subscription_plan, signatures_limit, signatures_used"
SUBSCRIPTION_FIELDS_WITH_PHONE = f"{SUBSCRIPTION_FIELDS}, phone"
_phone_column_available: bool | None = None
_subscription_columns_available: bool | None = None

PLAN_CATALOG: dict[str, dict[str, object]] = {
    "start": {"name": "Start (Testowy)", "signatures_limit": 20},
    "biznes": {"name": "Biznes", "signatures_limit": 200},
    "pro": {"name": "Pro", "signatures_limit": 800},
}


class OrganizationProfileResponse(BaseModel):
    name: str
    nip: str
    address: str
    phone: str
    subscription_plan: str = "Start (Testowy)"
    signatures_limit: int = 20
    signatures_used: int = 0


class OrganizationSubscriptionResponse(BaseModel):
    plan_id: str
    plan_name: str
    signatures_limit: int
    signatures_used: int = 0


class UpdateOrganizationProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    nip: str = ""
    address: str = ""
    phone: str = ""


class UpdateOrganizationSubscriptionRequest(BaseModel):
    plan_id: str = Field(min_length=1, max_length=32)

def _organization_supports_phone() -> bool:
    global _phone_column_available

    if _phone_column_available is not None:
        return _phone_column_available

    try:
        supabase.table("organizations").select(PROFILE_FIELDS_WITH_PHONE).limit(1).execute()
        _phone_column_available = True
    except Exception:
        _phone_column_available = False

    return _phone_column_available


def _organization_supports_subscription_fields() -> bool:
    global _subscription_columns_available

    if _subscription_columns_available is not None:
        return _subscription_columns_available

    try:
        supabase.table("organizations").select(
            "subscription_plan, signatures_limit, signatures_used"
        ).limit(1).execute()
        _subscription_columns_available = True
    except Exception:
        _subscription_columns_available = False

    return _subscription_columns_available


def _resolve_plan_id(plan_name: str | None) -> str:
    normalized = (plan_name or "").strip().lower()

    if "pro" in normalized:
        return "pro"

    if "biznes" in normalized or "business" in normalized:
        return "biznes"

    return "start"


def _catalog_signatures_limit(plan_name: str | None) -> int:
    plan_id = _resolve_plan_id(plan_name)
    return int(PLAN_CATALOG[plan_id]["signatures_limit"])


def _sync_signatures_limit_if_needed(organization_id: str, organization: dict) -> dict:
    if not _organization_supports_subscription_fields():
        return organization

    expected_limit = _catalog_signatures_limit(organization.get("subscription_plan"))
    current_limit = organization.get("signatures_limit")

    if current_limit is not None and int(current_limit) == expected_limit:
        return organization

    try:
        supabase.table("organizations").update({
            "signatures_limit": expected_limit,
        }).eq("id", organization_id).is_("deleted_at", "null").execute()
        organization["signatures_limit"] = expected_limit
    except Exception:
        logger.warning(
            "Failed to sync signatures_limit for organization %s to %s",
            organization_id,
            expected_limit,
            exc_info=True,
        )

    return organization


def _serialize_organization_profile(organization: dict) -> OrganizationProfileResponse:
    plan_name = str(organization.get("subscription_plan") or "Start (Testowy)")
    signatures_limit = _catalog_signatures_limit(plan_name)
    signatures_used = organization.get("signatures_used")

    return OrganizationProfileResponse(
        name=organization.get("name") or "",
        nip=organization.get("nip") or "",
        address=organization.get("address") or "",
        phone=organization.get("phone") or "",
        subscription_plan=plan_name,
        signatures_limit=signatures_limit,
        signatures_used=int(signatures_used) if signatures_used is not None else 0,
    )


def _fetch_organization_profile(organization_id: str) -> dict:
    if _organization_supports_phone() and _organization_supports_subscription_fields():
        fields = SUBSCRIPTION_FIELDS_WITH_PHONE
    elif _organization_supports_subscription_fields():
        fields = SUBSCRIPTION_FIELDS
    elif _organization_supports_phone():
        fields = PROFILE_FIELDS_WITH_PHONE
    else:
        fields = PROFILE_FIELDS_BASE

    organization_res = (
        supabase.table("organizations")
        .select(fields)
        .eq("id", organization_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )

    if not organization_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Организация не найдена.",
        )

    organization = organization_res.data

    if _organization_supports_subscription_fields():
        organization = _sync_signatures_limit_if_needed(organization_id, organization)

    return organization


@router.get("/profile", response_model=OrganizationProfileResponse)
async def get_organization_profile(current_user: CurrentUser = Depends(get_current_user)):
    try:
        organization = _fetch_organization_profile(str(current_user.organization_id))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to load organization profile.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить профиль агентства.",
        ) from exc

    return _serialize_organization_profile(organization)


@router.patch("/profile", response_model=OrganizationProfileResponse)
async def update_organization_profile(
    payload: UpdateOrganizationProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    organization_id = str(current_user.organization_id)
    update_payload = {
        "name": payload.name.strip(),
        "nip": payload.nip.strip(),
        "address": payload.address.strip(),
    }

    if _organization_supports_phone():
        update_payload["phone"] = payload.phone.strip()

    try:
        supabase.table("organizations").update(update_payload).eq(
            "id", organization_id
        ).is_("deleted_at", "null").execute()
    except Exception as exc:
        logger.exception("Failed to update organization profile.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сохранить профиль агентства.",
        ) from exc

    try:
        organization = _fetch_organization_profile(organization_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to reload organization profile after update.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить обновлённый профиль агентства.",
        ) from exc

    profile = _serialize_organization_profile(organization)

    if not _organization_supports_phone() and payload.phone.strip():
        profile.phone = payload.phone.strip()

    return profile


@router.get("/subscription", response_model=OrganizationSubscriptionResponse)
async def get_organization_subscription(current_user: CurrentUser = Depends(get_current_user)):
    try:
        organization = _fetch_organization_profile(str(current_user.organization_id))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to load organization subscription.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nie udało się pobrać planu subskrypcji.",
        ) from exc

    profile = _serialize_organization_profile(organization)
    plan_id = _resolve_plan_id(profile.subscription_plan)
    catalog_plan = PLAN_CATALOG[plan_id]

    return OrganizationSubscriptionResponse(
        plan_id=plan_id,
        plan_name=str(catalog_plan["name"]),
        signatures_limit=int(catalog_plan["signatures_limit"]),
        signatures_used=profile.signatures_used,
    )


@router.patch("/subscription", response_model=OrganizationSubscriptionResponse)
async def update_organization_subscription(
    payload: UpdateOrganizationSubscriptionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    plan_id = payload.plan_id.strip().lower()
    catalog_plan = PLAN_CATALOG.get(plan_id)

    if not catalog_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy plan subskrypcji.",
        )

    if plan_id == "pro":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan Pro jest obecnie w realizacji i nie jest jeszcze dostępny.",
        )

    if not _organization_supports_subscription_fields():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Baza danych nie obsługuje jeszcze pól subskrypcji organizacji.",
        )

    organization_id = str(current_user.organization_id)

    try:
        supabase.table("organizations").update({
            "subscription_plan": catalog_plan["name"],
            "signatures_limit": catalog_plan["signatures_limit"],
        }).eq("id", organization_id).is_("deleted_at", "null").execute()
    except Exception as exc:
        logger.exception("Failed to update organization subscription.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Nie udało się zaktualizować planu subskrypcji.",
        ) from exc

    organization = _fetch_organization_profile(organization_id)
    profile = _serialize_organization_profile(organization)

    return OrganizationSubscriptionResponse(
        plan_id=plan_id,
        plan_name=str(catalog_plan["name"]),
        signatures_limit=int(catalog_plan["signatures_limit"]),
        signatures_used=profile.signatures_used,
    )

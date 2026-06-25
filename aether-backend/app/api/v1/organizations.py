from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.database import supabase
from app.schemas.auth import CurrentUser

router = APIRouter()

PROFILE_FIELDS_BASE = "name, nip, address"
PROFILE_FIELDS_WITH_PHONE = f"{PROFILE_FIELDS_BASE}, phone"
_phone_column_available: bool | None = None


class OrganizationProfileResponse(BaseModel):
    name: str
    nip: str
    address: str
    phone: str


class UpdateOrganizationProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    nip: str = ""
    address: str = ""
    phone: str = ""


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


def _serialize_organization_profile(organization: dict) -> OrganizationProfileResponse:
    return OrganizationProfileResponse(
        name=organization.get("name") or "",
        nip=organization.get("nip") or "",
        address=organization.get("address") or "",
        phone=organization.get("phone") or "",
    )


def _fetch_organization_profile(organization_id: str) -> dict:
    fields = PROFILE_FIELDS_WITH_PHONE if _organization_supports_phone() else PROFILE_FIELDS_BASE

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

    return organization_res.data


@router.get("/profile", response_model=OrganizationProfileResponse)
async def get_organization_profile(current_user: CurrentUser = Depends(get_current_user)):
    try:
        organization = _fetch_organization_profile(str(current_user.organization_id))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить профиль агентства. Ошибка: {str(exc)}",
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

    select_fields = PROFILE_FIELDS_WITH_PHONE if _organization_supports_phone() else PROFILE_FIELDS_BASE

    try:
        organization_res = (
            supabase.table("organizations")
            .update(update_payload)
            .eq("id", organization_id)
            .is_("deleted_at", "null")
            .select(select_fields)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось сохранить профиль агентства. Ошибка: {str(exc)}",
        ) from exc

    if not organization_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Организация не найдена.",
        )

    profile = _serialize_organization_profile(organization_res.data)

    if not _organization_supports_phone() and payload.phone.strip():
        profile.phone = payload.phone.strip()

    return profile

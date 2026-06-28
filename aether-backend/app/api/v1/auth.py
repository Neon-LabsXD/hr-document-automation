import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.database import supabase, supabase_auth
from app.schemas.auth import TenantRegistrationRequest

logger = logging.getLogger("app.auth")

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(payload: LoginRequest):
    try:
        auth_res = supabase_auth.auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
    except Exception as exc:
        error_message = str(exc)

        if "Invalid login credentials" in error_message or "invalid_credentials" in error_message:
            detail = "Nieprawidłowy email lub hasło."
        elif "Email not confirmed" in error_message or "email_not_confirmed" in error_message:
            detail = "Potwierdź adres e-mail, aby się zalogować."
        else:
            detail = "Nie udało się zalogować. Spróbuj ponownie."

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        ) from exc

    if not auth_res or not auth_res.session or not auth_res.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie udało się zalogować. Spróbuj ponownie.",
        )

    return {
        "access_token": auth_res.session.access_token,
        "refresh_token": auth_res.session.refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(auth_res.user.id),
            "email": auth_res.user.email,
        },
    }


def _claim_invite_code_atomically(code: str) -> dict | None:
    """
    Атомарно «гасит» инвайт-код: обновит строку только если is_used = false.
    Если код уже использован или не существует — вернёт None.
    Предотвращает race-condition (двое одновременно регистрируются с одним кодом).
    """
    update_res = (
        supabase.table("invite_codes")
        .update({"is_used": True})
        .eq("code", code)
        .eq("is_used", False)
        .execute()
    )

    if not update_res.data:
        return None

    return update_res.data[0]


def _release_invite_code(invite_id: str) -> None:
    """Возвращает инвайт-код в «свободное» состояние, если регистрация не удалась."""
    try:
        supabase.table("invite_codes").update(
            {"is_used": False, "used_by_company_id": None}
        ).eq("id", invite_id).execute()
    except Exception:
        logger.exception("Failed to release invite code %s after failed registration.", invite_id)


@router.post("/register-tenant")
async def register_tenant(payload: TenantRegistrationRequest):
    """
    Регистрация нового агентства по инвайт-коду.
    Email подтверждается автоматически (бета): пользователь может войти сразу после регистрации.
    """
    claimed_invite = _claim_invite_code_atomically(payload.invite_code)

    if not claimed_invite:
        existing = (
            supabase.table("invite_codes")
            .select("is_used")
            .eq("code", payload.invite_code)
            .limit(1)
            .execute()
        )

        if existing.data and existing.data[0].get("is_used"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Этот код уже был использован.",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный инвайт-код.",
        )

    associated_plan = claimed_invite.get("associated_plan")
    signatures_limit = 20 if associated_plan == "Biznes" else 50

    organization_id: str | None = None

    try:
        org_res = (
            supabase.table("organizations")
            .insert(
                {
                    "name": payload.company_name,
                    "subscription_plan": associated_plan,
                    "signatures_limit": signatures_limit,
                }
            )
            .execute()
        )

        if not org_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось создать организацию.",
            )

        organization_id = org_res.data[0]["id"]

        create_user_payload = {
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": payload.full_name,
            },
            "app_metadata": {
                "organization_id": organization_id,
                "role": "Administrator",
            },
        }

        try:
            auth_res = supabase.auth.admin.create_user(create_user_payload)
        except Exception as exc:
            logger.warning(
                "Supabase create_user failed during tenant registration: %s",
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует или данные невалидны.",
            ) from exc

        user_id = auth_res.user.id

        supabase.table("profiles").insert(
            {
                "id": user_id,
                "organization_id": organization_id,
                "role": "Administrator",
                "full_name": payload.full_name,
                "email": payload.email,
            }
        ).execute()

        supabase.table("invite_codes").update(
            {"used_by_company_id": organization_id}
        ).eq("id", claimed_invite["id"]).execute()

    except HTTPException:
        if organization_id:
            try:
                supabase.table("organizations").delete().eq("id", organization_id).execute()
            except Exception:
                logger.exception("Failed to rollback organization %s.", organization_id)
        _release_invite_code(claimed_invite["id"])
        raise
    except Exception as exc:
        if organization_id:
            try:
                supabase.table("organizations").delete().eq("id", organization_id).execute()
            except Exception:
                logger.exception("Failed to rollback organization %s.", organization_id)
        _release_invite_code(claimed_invite["id"])
        logger.exception("Unexpected error during tenant registration.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось завершить регистрацию агентства.",
        ) from exc

    return {
        "status": "success",
        "message": "Организация успешно создана. Możesz się teraz zalogować.",
        "organization_id": organization_id,
    }

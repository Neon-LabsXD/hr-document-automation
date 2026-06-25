import json
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.schemas.auth import TenantRegistrationRequest
from app.core.database import supabase, supabase_auth

router = APIRouter()
DEBUG_LOG_PATH = Path(__file__).resolve().parents[3] / ".." / "debug-b806ce.log"


# region agent log
def _debug_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict[str, Any]) -> None:
    try:
        entry = {
            "sessionId": "b806ce",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with DEBUG_LOG_PATH.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# endregion


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(payload: LoginRequest):
    try:
        auth_res = supabase_auth.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
    except Exception as exc:
        error_message = str(exc)

        if "Invalid login credentials" in error_message or "invalid_credentials" in error_message:
            detail = "Nieprawidłowy email lub hasło."
        else:
            detail = "Nie udało się zalogować. Spróbuj ponownie."

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        ) from exc

    return {
        "access_token": auth_res.session.access_token,
        "refresh_token": auth_res.session.refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(auth_res.user.id),
            "email": auth_res.user.email,
        },
    }


@router.post("/register-tenant")
async def register_tenant(payload: TenantRegistrationRequest):
    """
    Эндпоинт регистрации нового агентства строго по инвайт-коду.
    """
    # 1. Проверяем существование и статус инвайт-кода
    invite_res = supabase.table("invite_codes").select("*").eq("code", payload.invite_code).execute()
    
    if not invite_res.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный инвайт-код.")
        
    invite_data = invite_res.data[0]
    
    if invite_data.get("is_used"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Этот код уже был использован.")

    # 2. Создаем организацию (Агентство)
    associated_plan = invite_data.get("associated_plan")
    signatures_limit = 20 if associated_plan == "Biznes" else 50 # Базовая логика лимитов
    
    org_res = supabase.table("organizations").insert({
        "name": payload.company_name,
        "subscription_plan": associated_plan,
        "signatures_limit": signatures_limit
    }).execute()
    
    organization_id = org_res.data[0]["id"]

    # 3. Регистрируем пользователя в Supabase Auth.
    # Данные авторизации храним в app_metadata и таблице profiles, а не в user-editable metadata.
    create_user_payload = {
        "email": payload.email,
        "password": payload.password,
        "email_confirm": True, # Автоматически подтверждаем почту для MVP
        "user_metadata": {
            "full_name": payload.full_name,
        },
        "app_metadata": {
            "organization_id": organization_id,
            "role": "Administrator" # Первый пользователь всегда становится админом агентства
        }
    }

    _debug_log(
        "register-tenant",
        "H1,H2,H3,H4",
        "aether-backend/app/api/v1/auth.py:register_tenant",
        "supabase create_user payload prepared",
        {
            "hasRootRole": "role" in create_user_payload,
            "hasAppMetadataRole": create_user_payload.get("app_metadata", {}).get("role") == "Administrator",
            "usesAdminCreateUser": True,
        },
    )

    try:
        auth_res = supabase.auth.admin.create_user(create_user_payload)
    except Exception as exc:
        try:
            supabase.table("organizations").delete().eq("id", organization_id).execute()
        except Exception:
            pass

        _debug_log(
            "register-tenant",
            "H1,H2,H3,H4",
            "aether-backend/app/api/v1/auth.py:register_tenant",
            "supabase create_user failed during tenant registration",
            {
                "emailDomain": payload.email.split("@")[-1] if "@" in payload.email else "invalid",
                "exceptionType": type(exc).__name__,
                "organizationCleanupAttempted": True,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует",
        ) from exc
    
    user_id = auth_res.user.id

    # 4. Создаем профиль пользователя в нашей таблице profiles
    supabase.table("profiles").insert({
        "id": user_id,
        "organization_id": organization_id,
        "role": "Administrator",
        "full_name": payload.full_name,
        "email": payload.email
    }).execute()

    # 5. Гасим инвайт-код (отмечаем как использованный)
    supabase.table("invite_codes").update({
        "is_used": True,
        "used_by_company_id": organization_id
    }).eq("id", invite_data["id"]).execute()

    return {
        "status": "success", 
        "message": "Организация успешно создана", 
        "organization_id": organization_id
    }
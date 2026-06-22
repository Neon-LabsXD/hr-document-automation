from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.schemas.auth import TenantRegistrationRequest
from app.core.database import supabase

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(payload: LoginRequest):
    try:
        auth_res = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный email или пароль",
        ) from exc

    return {
        "access_token": auth_res.session.access_token,
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
    auth_res = supabase.auth.admin.create_user({
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
    })
    
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
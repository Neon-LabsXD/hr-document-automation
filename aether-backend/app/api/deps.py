import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import supabase, supabase_auth
from app.schemas.auth import CurrentUser

logger = logging.getLogger("app.auth")
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    """
    Главный перехватчик авторизации.

    Tenant-изоляция берётся ТОЛЬКО из серверной таблицы profiles, никогда
    из user_metadata (которое юзер может редактировать через Supabase Auth API).
    """
    token = credentials.credentials

    try:
        user_res = supabase_auth.auth.get_user(token)
    except Exception as exc:
        logger.warning("Supabase get_user failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек.",
        ) from exc

    if not user_res or not user_res.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек.",
        )

    try:
        profile_res = (
            supabase.table("profiles")
            .select("organization_id, role")
            .eq("id", str(user_res.user.id))
            .single()
            .execute()
        )
    except Exception as exc:
        logger.warning("Profile lookup failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек.",
        ) from exc

    profile_data = profile_res.data or {}
    org_id = profile_data.get("organization_id")
    role = profile_data.get("role")

    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен: пользователь не привязан к организации.",
        )

    return CurrentUser(
        id=user_res.user.id,
        email=user_res.user.email,
        organization_id=org_id,
        role=role or "Rekruter",
    )

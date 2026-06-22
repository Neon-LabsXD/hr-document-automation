from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.database import supabase
from app.schemas.auth import CurrentUser

# Встроенный класс FastAPI для извлечения токена из заголовка Authorization: Bearer <token>
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Главный перехватчик (Middleware). Проверяет токен через Supabase и возвращает данные пользователя.
    Tenant isolation берется только из серверной таблицы profiles, а не из user_metadata.
    """
    token = credentials.credentials

    try:
        user_res = supabase.auth.get_user(token)
        profile_res = (
            supabase.table("profiles")
            .select("organization_id, role")
            .eq("id", str(user_res.user.id))
            .single()
            .execute()
        )
        profile_data = profile_res.data or {}
        org_id = profile_data.get("organization_id")
        role = profile_data.get("role")

        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещен: пользователь не привязан к организации."
            )

        return CurrentUser(
            id=user_res.user.id,
            email=user_res.user.email,
            organization_id=org_id,
            role=role or "Rekruter"
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек."
        ) from exc
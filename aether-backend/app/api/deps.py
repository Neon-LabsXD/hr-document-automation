from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.database import supabase
from app.schemas.auth import CurrentUser

# Встроенный класс FastAPI для извлечения токена из заголовка Authorization: Bearer <token>
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Главный перехватчик (Middleware). Проверяет токен через Supabase и возвращает данные пользователя.
    Если токен подделан, истек или не содержит organization_id — мгновенно блокирует запрос.
    """
    token = credentials.credentials

    try:
        user_res = supabase.auth.get_user(token)
        user_metadata = user_res.user.user_metadata or {}

        org_id = user_metadata.get("organization_id")
        role = user_metadata.get("role")

        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещен: Пользователь не привязан к организации"
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
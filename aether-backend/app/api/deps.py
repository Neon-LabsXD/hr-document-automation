import json
import time
from pathlib import Path
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.database import supabase, supabase_auth
from app.schemas.auth import CurrentUser

# Встроенный класс FastAPI для извлечения токена из заголовка Authorization: Bearer <token>
security = HTTPBearer()
DEBUG_LOG_PATH = Path(__file__).resolve().parents[3] / "debug-b806ce.log"


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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Главный перехватчик (Middleware). Проверяет токен через Supabase и возвращает данные пользователя.
    Tenant isolation берется только из серверной таблицы profiles, а не из user_metadata.
    """
    token = credentials.credentials
    _debug_log(
        "auth-401",
        "H1,H4",
        "aether-backend/app/api/deps.py:get_current_user",
        "authorization credentials extracted",
        {
            "scheme": credentials.scheme,
            "tokenLength": len(token) if token else 0,
            "tokenSegments": len(token.split(".")) if token else 0,
        },
    )

    try:
        user_res = supabase_auth.auth.get_user(token)
        _debug_log(
            "auth-401",
            "H2,H4",
            "aether-backend/app/api/deps.py:get_current_user",
            "supabase auth get_user succeeded",
            {
                "hasUser": bool(user_res.user),
                "userIdPresent": bool(getattr(user_res.user, "id", None)),
                "dbClientUsesServiceRole": True,
                "authClientSeparated": True,
            },
        )
    except Exception as exc:
        print(exc)
        _debug_log(
            "auth-401",
            "H2",
            "aether-backend/app/api/deps.py:get_current_user",
            "supabase auth get_user failed",
            {
                "exceptionType": type(exc).__name__,
                "exceptionMessage": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек."
        ) from exc

    try:
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
        _debug_log(
            "auth-401",
            "H3,H5",
            "aether-backend/app/api/deps.py:get_current_user",
            "profile lookup completed",
            {
                "hasProfile": bool(profile_data),
                "hasOrganization": bool(org_id),
                "role": role,
            },
        )

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
        print(exc)
        _debug_log(
            "auth-401",
            "H3,H5",
            "aether-backend/app/api/deps.py:get_current_user",
            "profile lookup failed after valid auth",
            {
                "exceptionType": type(exc).__name__,
                "exceptionMessage": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен авторизации или срок его действия истек."
        ) from exc
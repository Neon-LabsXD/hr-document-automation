from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, candidates, documents, ocr, organizations, templates, webhooks
from app.api.deps import get_current_user
from app.core.config import settings
from app.schemas.auth import CurrentUser

LOCAL_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

PRODUCTION_ORIGINS = [
    "https://app.aetherflow.pl",
]


def _resolve_cors_origins() -> list[str]:
    """
    В production пускаем whitelist из PRODUCTION_ORIGINS + ALLOWED_ORIGINS.
    В dev/staging добавляем стандартные локальные origin'ы для удобства.
    """
    configured_origins = settings.ALLOWED_ORIGINS

    if settings.ENVIRONMENT == "production":
        seed = [*PRODUCTION_ORIGINS, *configured_origins]
    else:
        seed = [*LOCAL_DEV_ORIGINS, *configured_origins]

    return list(
        dict.fromkeys(
            origin.rstrip("/")
            for origin in seed
            if isinstance(origin, str) and origin.strip() and origin != "*"
        )
    )


origins = _resolve_cors_origins()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Авторизация"])
app.include_router(organizations.router, prefix="/api/v1/organization", tags=["Организация"])
app.include_router(candidates.router, prefix="/api/v1/candidates", tags=["Кандидаты"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["Шаблоны документов"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Генерация документов"])
app.include_router(ocr.router, prefix="/api/v1/ocr", tags=["OCR (bez LLM)"])
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"status": "healthy", "project": settings.PROJECT_NAME}


@app.get("/api/v1/test-auth")
async def test_protected_route(current_user: CurrentUser = Depends(get_current_user)):
    """
    Проверяет, что frontend отправляет валидный Supabase JWT в Authorization header.
    """
    return {
        "message": "Успешно! Доступ разрешен.",
        "user_details": {
            "user_id": str(current_user.id),
            "organization_id": str(current_user.organization_id),
            "role": current_user.role,
        },
    }

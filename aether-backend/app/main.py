from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

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
origins = list(
    dict.fromkeys(
        origin.rstrip("/")
        for origin in [*LOCAL_DEV_ORIGINS, *settings.ALLOWED_ORIGINS]
        if origin and origin != "*"
    )
)

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
app.include_router(ocr.router, prefix="/api/v1/ocr", tags=["ИИ Распознавание (OCR)"])
app.include_router(webhooks.router, prefix="/api")

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
            "role": current_user.role
        }
    }


class TestSignatureSchema(BaseModel):
    template_id: int
    employee_email: EmailStr
    employee_name: str


@app.post("/api/test-signature")
async def test_signature(payload: TestSignatureSchema):
    from app.services.signature_service import send_contract_from_template
    from app.core.config import settings

    try:
        result = await send_contract_from_template(
            template_id=payload.template_id,
            employee_email=payload.employee_email,
            employee_name=payload.employee_name,
            prefill_data={"Full Name": payload.employee_name}
        )
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}
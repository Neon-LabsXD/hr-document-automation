from pydantic import BaseModel
from uuid import UUID

class CurrentUser(BaseModel):
    """
    Модель текущего пользователя, которая будет лежать в оперативной памяти 
    после успешной расшифровки JWT-токена.
    """
    id: UUID
    email: str
    organization_id: UUID
    role: str

class TenantRegistrationRequest(BaseModel):
    """
    Схема данных, которые фронтенд присылает при попытке зарегистрировать новое агентство.
    """
    company_name: str
    email: str
    password: str
    full_name: str
    invite_code: str
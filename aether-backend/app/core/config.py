from pathlib import Path
from typing import List

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "Aether Flow Бэкенд"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Настройки CORS (будут подтягиваться из .env)
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Конфигурация Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str  # Нужен для моментальной расшифровки токенов в памяти
    
    # Конфигурация Gmail SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: EmailStr
    SMTP_PASSWORD: str  # Специальный пароль приложения (App Password)
    
    # Конфигурация OpenAI
    OPENAI_API_KEY: str

    # Конфигурация DocuSeal
    DOCUSEAL_API_URL: str = "https://docuseal.eu/api"
    DOCUSEAL_API_KEY: str = ""
    DOCUSEAL_USER_EMAIL: str = ""

    @field_validator(
        "DOCUSEAL_API_KEY",
        "DOCUSEAL_API_URL",
        "DOCUSEAL_USER_EMAIL",
        mode="before",
    )
    @classmethod
    def strip_wrapping_quotes(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().strip('"').strip("'")
        return value

    # Автоматическое чтение из .env в корне aether-backend
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
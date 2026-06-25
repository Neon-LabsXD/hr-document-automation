from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import EmailStr
from typing import List

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
    DOCUSEAL_API_URL: str = "https://api.docuseal.com"
    DOCUSEAL_API_KEY: str
    DOCUSEAL_USER_EMAIL: str = ""

    # Автоматическое чтение из файла .env в корне проекта
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
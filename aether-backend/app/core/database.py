from supabase import create_client, Client
from app.core.config import settings

# Инициализируем клиент Supabase с правами администратора (SERVICE_ROLE_KEY)
# Это нужно бэкенду для безопасного создания пользователей и организаций
supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL, 
    supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY
)
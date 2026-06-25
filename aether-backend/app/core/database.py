from supabase import create_client, Client
from app.core.config import settings

# Инициализируем клиент Supabase с правами администратора (SERVICE_ROLE_KEY)
# Это нужно бэкенду для безопасного создания пользователей и организаций
supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL, 
    supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY
)

# Отдельный клиент для пользовательских Auth-операций, чтобы sign_in_with_password
# не менял глобальную сессию service_role клиента, который используется для БД.
supabase_auth: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_ANON_KEY
)
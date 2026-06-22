import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.core.database import supabase

logger = logging.getLogger("app")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/docuseal", status_code=status.HTTP_200_OK)
async def handle_docuseal_webhook(request: Request):
    """
    Принимает уведомления от DocuSeal о статусе подписания документов.
    """
    try:
        payload = await request.json()
        event_type = payload.get("event_type")
        data = payload.get("data", {})

        logger.info(f"Получен webhook от DocuSeal. Событие: {event_type}")

        if event_type == "form.completed":
            # Извлекаем ID сессии DocuSeal
            submission_id = data.get("submission_id") or data.get("id")

            if not submission_id:
                logger.warning("В payload вебхука отсутствует ID сессии.")
                return {"status": "ignored", "reason": "no_id"}

            logger.info(f"Документ {submission_id} успешно подписан кандидатом!")

            # Текущее время в формате ISO с таймзоной для Supabase (timestampz)
            current_time = datetime.now(timezone.utc).isoformat()

            try:
                # Стучимся строго в твою таблицу 'documents'
                result = (
                    supabase.table("documents")
                    .update({
                        "current_status": "signed",
                        "signed_at": current_time,
                    })
                    .eq("docuseal_id", str(submission_id))
                    .execute()
                )

                logger.info(f"Supabase успешно обновил документ {submission_id} в статус 'signed'")

            except Exception as db_err:
                # Логируем ошибку базы, но возвращаем 200, чтобы DocuSeal не слал повторы запроса
                logger.error(f"Ошибка при обновлении базы данных Supabase: {str(db_err)}")

            return {"status": "processed"}

        return {"status": "ignored", "event": event_type}

    except Exception as e:
        logger.error(f"Критическая ошибка парсинга вебхука DocuSeal: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")

import base64
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from openai import OpenAI, OpenAIError

from app.api.deps import get_current_user
from app.core.config import settings
from app.schemas.auth import CurrentUser

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
OCR_SYSTEM_PROMPT = (
    "Ты — специализированный HR-модуль OCR для польского рынка. Твоя задача — извлечь "
    "персональные данные из фотографии паспорта или Карты Побыту (Karta Pobytu). Вытащи "
    "данные и верни СТРОГО JSON-объект со следующими ключами (если поле не найдено или "
    "смазано, верни для него null):\n"
    "- employee_name: Имя и Фамилия латиницей (как в документе).\n"
    "- employee_passport: Серия и номер паспорта или номер карты побыту.\n"
    "- employee_address: Адрес проживания / прописки (если указан). Если на карте побыту "
    "адреса нет, оставь null.\n"
    "- pesel: Номер PESEL (11 цифр), если он присутствует на документе.\n"
    "Отвечай только валидным JSON-объектом, без разметки markdown и без лишнего текста."
)


def _get_image_mime_type(filename: str) -> str:
    extension = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только изображения .jpg, .jpeg или .png.",
        )

    return "image/png" if extension == ".png" else "image/jpeg"


@router.post("/scan-passport")
async def scan_passport(
    file: UploadFile = File(...),
    _current_user: CurrentUser = Depends(get_current_user),
):
    filename = file.filename or ""
    image_mime_type = _get_image_mime_type(filename)

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY не настроен на сервере.",
        )

    try:
        image_bytes = await file.read()
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": OCR_SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Извлеки данные из этого документа и верни только JSON.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image_mime_type};base64,{encoded_image}",
                            },
                        },
                    ],
                },
            ],
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("OpenAI вернул пустой ответ.")

        return json.loads(content)
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка OpenAI API при распознавании документа: {str(exc)}",
        ) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenAI вернул ответ, который не удалось разобрать как JSON.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось распознать документ. Ошибка: {str(exc)}",
        ) from exc

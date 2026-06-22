from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.core.database import supabase
from app.schemas.auth import CurrentUser

router = APIRouter()


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Загружает DOCX-шаблон в приватный бакет организации.
    """
    original_filename = file.filename or ""
    filename = original_filename.replace("\\", "/").split("/")[-1]

    if not filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только файлы с расширением .docx.",
        )

    storage_path = f"{current_user.organization_id}/templates/{filename}"
    file_content = await file.read()

    try:
        supabase.storage.from_("agency-files").upload(
            path=storage_path,
            file=file_content,
            file_options={
                "content-type": (
                    file.content_type
                    or "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ),
                # Временно убираем "upsert", чтобы обойти баг сервера Supabase после удаления
            },
        )
    except Exception as exc:
        # Добавляем str(exc), чтобы реальная ошибка вывелась в Swagger, а не пряталась
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось загрузить шаблон в Supabase Storage. Ошибка: {str(exc)}",
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось загрузить шаблон в Supabase Storage.",
        ) from exc

    return {
        "status": "success",
        "path": storage_path,
        "filename": filename,
    }

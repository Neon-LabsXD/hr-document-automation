from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.database import supabase
from app.schemas.auth import CurrentUser
from app.services.docuseal import (
    create_builder_token,
    create_docuseal_template_from_pdf,
    docuseal_builder_host,
)

router = APIRouter()
STORAGE_BUCKET = "agency-files"


class BuilderTokenRequest(BaseModel):
    docuseal_template_id: int
    template_name: str | None = None


def _safe_pdf_filename(filename: str) -> str:
    safe_name = (filename or "").replace("\\", "/").split("/")[-1].strip()

    if not safe_name or not safe_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только файлы с расширением .pdf.",
        )

    return safe_name


def _templates_prefix(organization_id: str) -> str:
    return f"{organization_id}/templates"


def _template_storage_path(organization_id: str, filename: str) -> str:
    return f"{_templates_prefix(organization_id)}/{_safe_pdf_filename(filename)}"


def template_display_name(filename: str) -> str:
    name = (filename or "").strip()

    if name.lower().endswith(".pdf"):
        return name[:-4]

    return name or "Dokument"


def _serialize_template_item(
    item: dict[str, Any],
    organization_id: str,
    template_id: int,
    docuseal_template_id: int | None = None,
) -> dict[str, Any] | None:
    filename = item.get("name")

    if not filename or str(filename).startswith("."):
        return None

    if not str(filename).lower().endswith(".pdf"):
        return None

    metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
    size = metadata.get("size")

    return {
        "id": template_id,
        "name": filename,
        "filename": filename,
        "path": _template_storage_path(organization_id, filename),
        "size": size,
        "updated_at": item.get("updated_at") or item.get("created_at"),
        "docuseal_template_id": docuseal_template_id,
    }


def _get_organization_docuseal_template_id(organization_id: str) -> int | None:
    try:
        organization_res = (
            supabase.table("organizations")
            .select("docuseal_template_id")
            .eq("id", organization_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить docuseal_template_id организации. Ошибка: {str(exc)}",
        ) from exc

    docuseal_template_id = (organization_res.data or {}).get("docuseal_template_id")

    if docuseal_template_id is None:
        return None

    try:
        return int(docuseal_template_id)
    except (TypeError, ValueError):
        return None


def _latest_template_filename(items: list[dict[str, Any]]) -> str | None:
    if not items:
        return None

    latest_item = max(
        items,
        key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
    )
    filename = latest_item.get("name")

    return str(filename) if filename else None


def list_organization_templates(organization_id: str) -> list[dict[str, Any]]:
    prefix = _templates_prefix(organization_id)
    docuseal_template_id = _get_organization_docuseal_template_id(organization_id)

    try:
        storage_items = supabase.storage.from_(STORAGE_BUCKET).list(prefix)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить список шаблонов. Ошибка: {str(exc)}",
        ) from exc

    visible_items = sorted(
        [
            item
            for item in storage_items or []
            if item.get("name")
            and not str(item.get("name")).startswith(".")
            and str(item.get("name")).lower().endswith(".pdf")
        ],
        key=lambda item: str(item.get("name")).lower(),
    )
    linked_filename = _latest_template_filename(visible_items)

    return [
        serialized
        for index, item in enumerate(visible_items, start=1)
        if (
            serialized := _serialize_template_item(
                item,
                organization_id,
                index,
                docuseal_template_id
                if docuseal_template_id and linked_filename and item.get("name") == linked_filename
                else None,
            )
        )
        is not None
    ]


def _save_organization_docuseal_template_id(organization_id: str, docuseal_template_id: int) -> None:
    try:
        supabase.table("organizations").update({
            "docuseal_template_id": docuseal_template_id,
        }).eq("id", organization_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось сохранить docuseal_template_id в Supabase. Ошибка: {str(exc)}",
        ) from exc


@router.get("")
@router.get("/list")
async def list_templates(current_user: CurrentUser = Depends(get_current_user)):
    """
    Возвращает PDF-шаблоны, загруженные текущей организацией.
    """
    templates = list_organization_templates(str(current_user.organization_id))

    return {"templates": templates}


@router.post("/builder-token")
async def get_builder_token(
    payload: BuilderTokenRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Генерирует JWT для встроенного конструктора полей DocuSeal (Embedded Form Builder).
    """
    token = create_builder_token(
        recruiter_email=current_user.email,
        template_id=payload.docuseal_template_id,
        template_name=payload.template_name,
        external_id=str(current_user.organization_id),
    )

    return {
        "builder_token": token,
        "builder_host": docuseal_builder_host(),
    }


@router.delete("/{filename}")
async def delete_template(filename: str, current_user: CurrentUser = Depends(get_current_user)):
    """
    Удаляет PDF-шаблон организации из Supabase Storage.
    """
    storage_path = _template_storage_path(str(current_user.organization_id), filename)

    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось удалить шаблон. Ошибка: {str(exc)}",
        ) from exc

    return {"status": "success", "filename": _safe_pdf_filename(filename)}


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Загружает PDF в DocuSeal как шаблон и сохраняет docuseal_template_id организации.
    """
    organization_id = str(current_user.organization_id)
    original_filename = file.filename or ""
    filename = _safe_pdf_filename(original_filename)
    file_content = await file.read()

    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загруженный файл пуст.",
        )

    try:
        docuseal_template = await create_docuseal_template_from_pdf(
            file_content,
            filename,
            template_name=filename.rsplit(".", 1)[0],
            external_id=organization_id,
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось подключиться к DocuSeal API: {str(exc)}",
        ) from exc

    docuseal_template_id = int(docuseal_template["id"])
    template_display = filename.rsplit(".", 1)[0]
    builder_token = create_builder_token(
        recruiter_email=current_user.email,
        template_id=docuseal_template_id,
        template_name=template_display,
        external_id=organization_id,
    )
    builder_host = docuseal_builder_host()

    _save_organization_docuseal_template_id(organization_id, docuseal_template_id)

    storage_path = _template_storage_path(organization_id, filename)

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_content,
            {"content-type": file.content_type or "application/pdf"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось загрузить шаблон в Supabase Storage. Ошибка: {str(exc)}",
        ) from exc

    return {
        "status": "success",
        "path": storage_path,
        "filename": filename,
        "docuseal_template_id": docuseal_template_id,
        "builder_token": builder_token,
        "builder_host": builder_host,
    }

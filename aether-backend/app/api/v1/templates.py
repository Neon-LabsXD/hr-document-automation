import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

logger = logging.getLogger("app.templates")

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
MAX_ORGANIZATION_TEMPLATES = 10
MAX_TEMPLATE_PDF_BYTES = 10 * 1024 * 1024  # 10 MB
REGISTRY_FILENAME = "_templates_registry.json"
REGISTRY_META_KEY = "__meta__"
DEFAULT_TEMPLATE_FILENAME_KEY = "default_template_filename"


class BuilderTokenRequest(BaseModel):
    docuseal_template_id: int
    template_name: str | None = None


class SetDefaultTemplateRequest(BaseModel):
    template_id: int


def _safe_pdf_filename(filename: str) -> str:
    safe_name = (filename or "").replace("\\", "/").split("/")[-1].strip()

    if not safe_name or not safe_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешены только файлы с расширением .pdf.",
        )

    # Защита от path traversal и скрытых файлов.
    if (
        safe_name.startswith(".")
        or ".." in safe_name
        or "\x00" in safe_name
        or "/" in safe_name
        or "\\" in safe_name
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Niedozwolona nazwa pliku.",
        )

    if len(safe_name) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nazwa pliku jest zbyt długa (maks. 200 znaków).",
        )

    return safe_name


def _templates_prefix(organization_id: str) -> str:
    return f"{organization_id}/templates"


def _template_storage_path(organization_id: str, filename: str) -> str:
    return f"{_templates_prefix(organization_id)}/{_safe_pdf_filename(filename)}"


def _registry_storage_path(organization_id: str) -> str:
    return f"{_templates_prefix(organization_id)}/{REGISTRY_FILENAME}"


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
    is_default_send: bool = False,
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
        "is_default_send": is_default_send,
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
        logger.exception("Failed to load docuseal_template_id for org %s.", organization_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить docuseal_template_id организации.",
        ) from exc

    docuseal_template_id = (organization_res.data or {}).get("docuseal_template_id")

    if docuseal_template_id is None:
        return None

    try:
        return int(docuseal_template_id)
    except (TypeError, ValueError):
        return None


def _load_raw_registry(organization_id: str) -> dict[str, Any]:
    try:
        raw = supabase.storage.from_(STORAGE_BUCKET).download(_registry_storage_path(organization_id))
        data = json.loads(raw.decode("utf-8"))

        if isinstance(data, dict):
            return data
    except Exception:
        pass

    return {}


def _load_template_registry(organization_id: str) -> dict[str, dict[str, Any]]:
    raw_registry = _load_raw_registry(organization_id)

    return {
        str(filename): entry
        for filename, entry in raw_registry.items()
        if filename != REGISTRY_META_KEY and isinstance(entry, dict)
    }


def _load_registry_meta(organization_id: str) -> dict[str, Any]:
    raw_registry = _load_raw_registry(organization_id)
    meta = raw_registry.get(REGISTRY_META_KEY)

    return meta if isinstance(meta, dict) else {}


def _save_template_registry(
    organization_id: str,
    registry: dict[str, dict[str, Any]],
    meta: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {**registry}

    if meta is not None:
        payload[REGISTRY_META_KEY] = meta
    else:
        existing_meta = _load_registry_meta(organization_id)
        if existing_meta:
            payload[REGISTRY_META_KEY] = existing_meta

    content = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            _registry_storage_path(organization_id),
            content,
            {"content-type": "application/json", "upsert": "true"},
        )
    except Exception as exc:
        logger.exception("Failed to save template registry.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сохранить реестр шаблонов.",
        ) from exc


def _get_default_template_filename(organization_id: str) -> str | None:
    meta = _load_registry_meta(organization_id)
    filename = meta.get(DEFAULT_TEMPLATE_FILENAME_KEY)

    if not filename:
        return None

    return str(filename)


def _set_default_template_filename(organization_id: str, filename: str) -> None:
    file_entries = _load_template_registry(organization_id)
    meta = _load_registry_meta(organization_id)
    meta[DEFAULT_TEMPLATE_FILENAME_KEY] = filename
    _save_template_registry(organization_id, file_entries, meta)


def _resolve_default_template_id(
    templates: list[dict[str, Any]],
    organization_id: str,
) -> int | None:
    default_filename = _get_default_template_filename(organization_id)

    if default_filename:
        for template in templates:
            if template.get("filename") == default_filename:
                return int(template["id"])

    if templates:
        return int(templates[0]["id"])

    return None


def _annotate_templates_with_default(
    templates: list[dict[str, Any]],
    default_template_id: int | None,
) -> list[dict[str, Any]]:
    annotated: list[dict[str, Any]] = []

    for template in templates:
        annotated.append({
            **template,
            "is_default_send": default_template_id is not None and template["id"] == default_template_id,
        })

    return annotated


def _registry_docuseal_template_id(registry_entry: dict[str, Any] | None) -> int | None:
    if not registry_entry:
        return None

    value = registry_entry.get("docuseal_template_id")

    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _list_storage_pdf_items(organization_id: str) -> list[dict[str, Any]]:
    prefix = _templates_prefix(organization_id)

    try:
        storage_items = supabase.storage.from_(STORAGE_BUCKET).list(prefix)
    except Exception as exc:
        logger.exception("Failed to list storage PDF items.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список шаблонов.",
        ) from exc

    return sorted(
        [
            item
            for item in storage_items or []
            if item.get("name")
            and not str(item.get("name")).startswith(".")
            and str(item.get("name")).lower().endswith(".pdf")
            and str(item.get("name")) != REGISTRY_FILENAME
        ],
        key=lambda item: str(item.get("name")).lower(),
    )


def _latest_template_filename(items: list[dict[str, Any]]) -> str | None:
    if not items:
        return None

    latest_item = max(
        items,
        key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
    )
    filename = latest_item.get("name")

    return str(filename) if filename else None


def _resolve_docuseal_template_id_for_file(
    filename: str,
    registry: dict[str, dict[str, Any]],
    legacy_org_docuseal_id: int | None,
    linked_filename: str | None,
) -> int | None:
    registry_id = _registry_docuseal_template_id(registry.get(filename))
    if registry_id is not None:
        return registry_id

    if legacy_org_docuseal_id and linked_filename == filename:
        return legacy_org_docuseal_id

    return None


def _maybe_backfill_registry_from_legacy(
    organization_id: str,
    registry: dict[str, dict[str, Any]],
    legacy_org_docuseal_id: int | None,
    linked_filename: str | None,
) -> dict[str, dict[str, Any]]:
    if not legacy_org_docuseal_id or not linked_filename or linked_filename in registry:
        return registry

    updated_registry = {
        **registry,
        linked_filename: {
            "docuseal_template_id": legacy_org_docuseal_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    meta = _load_registry_meta(organization_id)
    if not meta.get(DEFAULT_TEMPLATE_FILENAME_KEY):
        meta[DEFAULT_TEMPLATE_FILENAME_KEY] = linked_filename
    _save_template_registry(organization_id, updated_registry, meta)
    return updated_registry


def list_organization_templates(organization_id: str) -> list[dict[str, Any]]:
    visible_items = _list_storage_pdf_items(organization_id)
    legacy_org_docuseal_id = _get_organization_docuseal_template_id(organization_id)
    linked_filename = _latest_template_filename(visible_items)
    registry = _load_template_registry(organization_id)
    registry = _maybe_backfill_registry_from_legacy(
        organization_id,
        registry,
        legacy_org_docuseal_id,
        linked_filename,
    )
    default_template_id = _resolve_default_template_id(
        [
            {
                "id": index,
                "filename": str(item.get("name")),
            }
            for index, item in enumerate(visible_items, start=1)
        ],
        organization_id,
    )

    templates = [
        serialized
        for index, item in enumerate(visible_items, start=1)
        if (
            serialized := _serialize_template_item(
                item,
                organization_id,
                index,
                _resolve_docuseal_template_id_for_file(
                    str(item.get("name")),
                    registry,
                    legacy_org_docuseal_id,
                    linked_filename,
                ),
                is_default_send=default_template_id is not None and index == default_template_id,
            )
        )
        is not None
    ]

    return _annotate_templates_with_default(templates, default_template_id)


def get_default_send_template_id(organization_id: str) -> int | None:
    templates = list_organization_templates(organization_id)
    return _resolve_default_template_id(templates, organization_id)


def resolve_docuseal_template_id(organization_id: str, template_id: int | None) -> int:
    templates = list_organization_templates(organization_id)

    if template_id is not None:
        for template in templates:
            if template["id"] == template_id and template.get("docuseal_template_id"):
                return int(template["docuseal_template_id"])

    default_template_id = get_default_send_template_id(organization_id)

    if default_template_id is not None:
        for template in templates:
            if template["id"] == default_template_id and template.get("docuseal_template_id"):
                return int(template["docuseal_template_id"])

    for template in templates:
        if template.get("docuseal_template_id"):
            return int(template["docuseal_template_id"])

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="У агентства не настроен шаблон DocuSeal. Загрузите PDF в ustawieniach agencji.",
    )


def resolve_template_hourly_rate(organization_id: str, template_id: int) -> str:
    templates = list_organization_templates(organization_id)
    template = next((item for item in templates if item["id"] == template_id), None)

    if not template:
        return ""

    filename = template.get("filename")
    if not filename:
        return ""

    registry_entry = _load_template_registry(organization_id).get(str(filename)) or {}
    hourly_rate = registry_entry.get("hourly_rate")

    if hourly_rate is None:
        return ""

    if isinstance(hourly_rate, bool):
        return ""

    if isinstance(hourly_rate, int):
        return str(hourly_rate)

    if isinstance(hourly_rate, float):
        if hourly_rate.is_integer():
            return str(int(hourly_rate))
        return f"{hourly_rate:.2f}".rstrip("0").rstrip(".")

    return str(hourly_rate).strip()


def _save_organization_docuseal_template_id(organization_id: str, docuseal_template_id: int) -> None:
    try:
        supabase.table("organizations").update({
            "docuseal_template_id": docuseal_template_id,
        }).eq("id", organization_id).execute()
    except Exception as exc:
        logger.exception("Failed to save docuseal_template_id for org %s.", organization_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сохранить docuseal_template_id в Supabase.",
        ) from exc


def _upsert_template_registry_entry(
    organization_id: str,
    filename: str,
    docuseal_template_id: int,
) -> None:
    file_entries = _load_template_registry(organization_id)
    meta = _load_registry_meta(organization_id)
    file_entries[filename] = {
        "docuseal_template_id": docuseal_template_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if not meta.get(DEFAULT_TEMPLATE_FILENAME_KEY):
        meta[DEFAULT_TEMPLATE_FILENAME_KEY] = filename

    _save_template_registry(organization_id, file_entries, meta)


def _remove_template_registry_entry(organization_id: str, filename: str) -> None:
    file_entries = _load_template_registry(organization_id)
    meta = _load_registry_meta(organization_id)

    if filename not in file_entries:
        return

    file_entries.pop(filename, None)

    if meta.get(DEFAULT_TEMPLATE_FILENAME_KEY) == filename:
        remaining_filenames = sorted(file_entries.keys())
        if remaining_filenames:
            meta[DEFAULT_TEMPLATE_FILENAME_KEY] = remaining_filenames[0]
        else:
            meta.pop(DEFAULT_TEMPLATE_FILENAME_KEY, None)

    _save_template_registry(organization_id, file_entries, meta)


@router.get("")
@router.get("/list")
async def list_templates(current_user: CurrentUser = Depends(get_current_user)):
    """
    Возвращает PDF-шаблоны, загруженные текущей организацией.
    """
    organization_id = str(current_user.organization_id)
    templates = list_organization_templates(organization_id)
    default_template_id = get_default_send_template_id(organization_id)

    return {
        "templates": templates,
        "max_templates": MAX_ORGANIZATION_TEMPLATES,
        "default_template_id": default_template_id,
    }


@router.patch("/default")
async def set_default_template(
    payload: SetDefaultTemplateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Устанавливает шаблон по умолчанию для отправки кандидатам.
    """
    organization_id = str(current_user.organization_id)
    templates = list_organization_templates(organization_id)
    selected_template = next(
        (template for template in templates if template["id"] == payload.template_id),
        None,
    )

    if not selected_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wybrany szablon nie został znaleziony.",
        )

    _set_default_template_filename(organization_id, str(selected_template["filename"]))
    updated_templates = list_organization_templates(organization_id)

    return {
        "status": "success",
        "default_template_id": payload.template_id,
        "templates": updated_templates,
    }


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
    organization_id = str(current_user.organization_id)
    safe_filename = _safe_pdf_filename(filename)
    storage_path = _template_storage_path(organization_id, safe_filename)

    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
    except Exception as exc:
        logger.exception("Failed to delete template %s for org %s.", safe_filename, organization_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить шаблон.",
        ) from exc

    _remove_template_registry_entry(organization_id, safe_filename)

    return {"status": "success", "filename": safe_filename}


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Загружает PDF в DocuSeal как шаблон и сохраняет связь с файлом в реестре организации.
    """
    organization_id = str(current_user.organization_id)
    original_filename = file.filename or ""
    filename = _safe_pdf_filename(original_filename)

    # Читаем не больше лимита, чтобы не дать атакующему выжать всю память.
    file_content = await file.read(MAX_TEMPLATE_PDF_BYTES + 1)

    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загруженный файл пуст.",
        )

    if len(file_content) > MAX_TEMPLATE_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Plik PDF jest zbyt duży. Maksymalny rozmiar to 10 MB.",
        )

    # Базовая проверка, что это действительно PDF: должна быть сигнатура %PDF-.
    if not file_content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plik nie jest poprawnym dokumentem PDF.",
        )

    existing_items = _list_storage_pdf_items(organization_id)
    existing_filenames = {str(item.get("name")) for item in existing_items}
    is_replacement = filename in existing_filenames

    if not is_replacement and len(existing_items) >= MAX_ORGANIZATION_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Można przechowywać maksymalnie {MAX_ORGANIZATION_TEMPLATES} szablonów PDF. Usuń istniejący szablon, aby dodać nowy.",
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
        logger.exception("DocuSeal connection failed in /templates/upload.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось подключиться к DocuSeal API.",
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
    _upsert_template_registry_entry(organization_id, filename, docuseal_template_id)

    storage_path = _template_storage_path(organization_id, filename)

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_content,
            {
                "content-type": file.content_type or "application/pdf",
                "upsert": "true",
            },
        )
    except Exception as exc:
        logger.exception("Failed to upload template to Supabase Storage.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось загрузить шаблон в Supabase Storage.",
        ) from exc

    return {
        "status": "success",
        "path": storage_path,
        "filename": filename,
        "docuseal_template_id": docuseal_template_id,
        "builder_token": builder_token,
        "builder_host": builder_host,
    }

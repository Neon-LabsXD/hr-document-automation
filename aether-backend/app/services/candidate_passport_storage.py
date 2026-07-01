import logging
import mimetypes
import re
from datetime import datetime, timezone

from fastapi import UploadFile

from app.core.database import supabase

logger = logging.getLogger("app.candidate_passport_storage")

CANDIDATE_DOCUMENTS_BUCKET = "candidate-documents"
PASSPORT_STORAGE_PREFIX = "passports"


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", name.strip())
    return cleaned or "passport.jpg"


def _guess_content_type(file_name: str, upload_content_type: str | None) -> str:
    if upload_content_type and upload_content_type != "application/octet-stream":
        return upload_content_type

    guessed, _encoding = mimetypes.guess_type(file_name)
    return guessed or "application/octet-stream"


def _upload_passport_to_storage(
    candidate_id: str,
    file_name: str,
    file_bytes: bytes,
    content_type: str,
) -> str:
    safe_name = _sanitize_filename(file_name)
    storage_path = f"{PASSPORT_STORAGE_PREFIX}/{candidate_id}_{safe_name}"

    supabase.storage.from_(CANDIDATE_DOCUMENTS_BUCKET).upload(
        storage_path,
        file_bytes,
        {"content-type": content_type, "upsert": "true"},
    )

    return storage_path


def _update_candidate_passport_path(candidate_id: str, storage_path: str) -> None:
    supabase.table("candidates").update({
        "passport_path": storage_path,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", candidate_id).execute()


def store_candidate_passport_bytes(
    candidate_id: str,
    file_bytes: bytes,
    file_name: str,
    content_type: str | None = None,
) -> str | None:
    if not file_bytes:
        return None

    try:
        resolved_content_type = _guess_content_type(file_name, content_type)
        storage_path = _upload_passport_to_storage(
            candidate_id,
            file_name,
            file_bytes,
            resolved_content_type,
        )
        _update_candidate_passport_path(candidate_id, storage_path)
    except Exception:
        logger.exception(
            "Failed to store passport for candidate_id=%s (file_name=%s)",
            candidate_id,
            file_name,
        )
        return None

    logger.info(
        "Stored passport for candidate_id=%s at %s",
        candidate_id,
        storage_path,
    )
    return storage_path


async def store_candidate_passport_upload(
    candidate_id: str,
    upload_file: UploadFile,
) -> str | None:
    file_name = upload_file.filename or "passport.jpg"
    file_bytes = await upload_file.read()
    return store_candidate_passport_bytes(
        candidate_id,
        file_bytes,
        file_name,
        upload_file.content_type,
    )

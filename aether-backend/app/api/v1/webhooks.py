import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.core.database import supabase

logger = logging.getLogger("app")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

SIGNED_CANDIDATE_STATUS = "signed"
SIGNED_DOCUMENT_STATUS = "signed"
COMPLETED_SUBMISSION_EVENTS = {"submission.completed", "form.completed"}


def _extract_submission_id(data: dict[str, Any]) -> str | None:
    submission_id = data.get("submission_id") or data.get("id")
    return str(submission_id) if submission_id is not None else None


def _extract_submission_status(data: dict[str, Any]) -> str | None:
    status_value = data.get("status")
    return str(status_value).lower() if status_value is not None else None


def _extract_candidate_email(data: dict[str, Any]) -> str | None:
    submitters = data.get("submitters") or []

    for submitter in submitters:
        if not isinstance(submitter, dict):
            continue

        email = submitter.get("email")
        if email:
            return str(email).strip().lower()

    email = data.get("email")
    if email:
        return str(email).strip().lower()

    return None


def _find_candidate_id(submission_id: str | None, candidate_email: str | None) -> str | None:
    if submission_id:
        candidate_res = (
            supabase.table("candidates")
            .select("id")
            .eq("docuseal_id", submission_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if candidate_res.data:
            return str(candidate_res.data[0]["id"])

    if candidate_email:
        candidate_res = (
            supabase.table("candidates")
            .select("id")
            .eq("email", candidate_email)
            .is_("deleted_at", "null")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if candidate_res.data:
            return str(candidate_res.data[0]["id"])

    return None


def _mark_contract_signed(
    submission_id: str | None,
    candidate_email: str | None,
    submission_status: str | None,
) -> dict[str, str]:
    if submission_status and submission_status not in {"completed", "complete"}:
        return {"status": "ignored", "reason": "submission_not_completed"}

    current_time = datetime.now(timezone.utc).isoformat()
    candidate_id = _find_candidate_id(submission_id, candidate_email)

    if not candidate_id:
        logger.warning(
            "DocuSeal webhook: кандидат не найден (submission_id=%s, email=%s)",
            submission_id,
            candidate_email,
        )
        return {"status": "ignored", "reason": "candidate_not_found"}

    try:
        supabase.table("candidates").update({
            "status": SIGNED_CANDIDATE_STATUS,
            "updated_at": current_time,
        }).eq("id", candidate_id).execute()

        if submission_id:
            supabase.table("documents").update({
                "current_status": SIGNED_DOCUMENT_STATUS,
                "signed_at": current_time,
            }).eq("docuseal_id", submission_id).execute()

        logger.info(
            "Договор подписан: candidate_id=%s, submission_id=%s, email=%s",
            candidate_id,
            submission_id,
            candidate_email,
        )
    except Exception as db_err:
        logger.error("Ошибка при обновлении Supabase после webhook DocuSeal: %s", db_err)

    return {"status": "processed", "candidate_id": candidate_id}


@router.post("/docuseal", status_code=status.HTTP_200_OK)
async def handle_docuseal_webhook(request: Request):
    """
    Принимает уведомления от DocuSeal о статусе подписания документов.
    """
    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Критическая ошибка парсинга вебхука DocuSeal: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload") from exc

    event_type = payload.get("event_type")
    data = payload.get("data", {})

    if not isinstance(data, dict):
        data = {}

    logger.info("Получен webhook от DocuSeal. Событие: %s", event_type)

    if event_type in COMPLETED_SUBMISSION_EVENTS:
        submission_id = _extract_submission_id(data)
        candidate_email = _extract_candidate_email(data)
        submission_status = _extract_submission_status(data)

        return _mark_contract_signed(submission_id, candidate_email, submission_status)

    return {"status": "ignored", "event": event_type}

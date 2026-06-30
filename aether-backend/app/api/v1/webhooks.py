import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import settings
from app.core.database import supabase

logger = logging.getLogger("app")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

SIGNED_CANDIDATE_STATUS = "signed"
SIGNED_DOCUMENT_STATUS = "signed"
COMPLETED_SUBMISSION_EVENTS = {"submission.completed", "form.completed"}

# DocuSeal допускает рассинхрон часов в пределах 5 минут.
WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300


def _verify_docuseal_signature(raw_body: bytes, signature_header: str | None) -> None:
    """
    Проверяет подпись DocuSeal вебхука.

    Формат заголовка X-Docuseal-Signature: "<unix_timestamp>.<hex_signature>".
    Подпись = HMAC-SHA256(secret, "<unix_timestamp>." + raw_body).
    Сравнение — constant-time. Допустимый сдвиг времени — 5 минут.
    """
    secret = (settings.DOCUSEAL_WEBHOOK_SECRET or "").strip()

    if not secret:
        logger.error("DOCUSEAL_WEBHOOK_SECRET is not configured; rejecting webhook.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signing secret is not configured.",
        )

    if not signature_header or "." not in signature_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed signature header.",
        )

    timestamp_str, signature = signature_header.split(".", 1)

    try:
        timestamp_value = int(timestamp_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature timestamp.",
        ) from exc

    if abs(time.time() - timestamp_value) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook timestamp outside tolerance window.",
        )

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp_str}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature mismatch.",
        )


def _extract_submission_id(data: dict[str, Any]) -> str | None:
    submission_id = data.get("submission_id") or data.get("id")
    return str(submission_id) if submission_id is not None else None


def _extract_submission_status(data: dict[str, Any]) -> str | None:
    status_value = data.get("status")
    return str(status_value).lower() if status_value is not None else None


def _find_candidate_by_submission_id(submission_id: str | None) -> dict[str, Any] | None:
    """
    Ищем кандидата ТОЛЬКО по docuseal submission_id. Email-fallback убран —
    он позволял cross-tenant IDOR (поддельный вебхук с email жертвы мог пометить
    чужого кандидата подписавшим).
    """
    if not submission_id:
        return None

    candidate_res = (
        supabase.table("candidates")
        .select("id, organization_id, status, docuseal_id")
        .eq("docuseal_id", submission_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )

    candidate = candidate_res.data[0] if candidate_res.data else None
    print(
        f"=== DB CANDIDATE SEARCH RESULT ===: "
        f"submission_id={submission_id!r}, rows={candidate_res.data}, candidate={candidate}",
        flush=True,
    )

    if candidate:
        return candidate

    return None


def _increment_organization_signatures_used(organization_id: str) -> int:
    org_res = (
        supabase.table("organizations")
        .select("signatures_used, signatures_limit")
        .eq("id", organization_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )

    if not org_res.data:
        logger.warning(
            "DocuSeal webhook: organization not found for signature accounting (organization_id=%s)",
            organization_id,
        )
        return 0

    organization = org_res.data
    current_used = int(organization.get("signatures_used") or 0)
    signatures_limit = int(organization.get("signatures_limit") or 0)
    new_used = current_used + 1

    supabase.table("organizations").update({
        "signatures_used": new_used,
    }).eq("id", organization_id).execute()

    if signatures_limit > 0 and new_used > signatures_limit:
        logger.warning(
            "Organization %s exceeded signature limit: %s > %s",
            organization_id,
            new_used,
            signatures_limit,
        )

    return new_used


def _mark_contract_signed(
    submission_id: str | None,
    submission_status: str | None,
) -> dict[str, Any]:
    if submission_status and submission_status not in {"completed", "complete"}:
        return {"status": "ignored", "reason": "submission_not_completed"}

    current_time = datetime.now(timezone.utc).isoformat()
    candidate = _find_candidate_by_submission_id(submission_id)

    if not candidate:
        print(
            f"=== WARNING: Candidate with docuseal_id {submission_id} not found in DB ===",
            flush=True,
        )
        logger.warning(
            "DocuSeal webhook: candidate not found (submission_id=%s)",
            submission_id,
        )
        return {"status": "ignored", "reason": "candidate_not_found"}

    candidate_id = str(candidate["id"])
    organization_id = candidate.get("organization_id")
    previous_status = str(candidate.get("status") or "").lower()
    already_signed = previous_status == SIGNED_CANDIDATE_STATUS

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

        signatures_used: int | None = None
        if organization_id and not already_signed:
            signatures_used = _increment_organization_signatures_used(str(organization_id))

        logger.info(
            "Contract signed: candidate_id=%s, submission_id=%s, signatures_used=%s",
            candidate_id,
            submission_id,
            signatures_used,
        )
    except Exception:
        logger.exception("Failed to update Supabase after DocuSeal webhook.")
        return {"status": "error", "reason": "supabase_update_failed"}

    result: dict[str, Any] = {"status": "processed", "candidate_id": candidate_id}
    if signatures_used is not None:
        result["signatures_used"] = signatures_used
    return result


@router.post("/docuseal", status_code=status.HTTP_200_OK)
async def handle_docuseal_webhook(
    request: Request,
    x_docuseal_signature: str | None = Header(default=None, alias="X-Docuseal-Signature"),
):
    """
    Принимает уведомления от DocuSeal. Каждый запрос обязательно
    подписан DocuSeal'ом через HMAC-SHA256 (X-Docuseal-Signature).
    """
    raw_body = await request.body()
    _verify_docuseal_signature(raw_body, x_docuseal_signature)

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        logger.warning("DocuSeal webhook payload is not valid JSON.")
        raise HTTPException(status_code=400, detail="Invalid payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    print(f"=== DOCUSEAL WEBHOOK PAYLOAD ===: {payload}", flush=True)

    event_type = payload.get("event_type") or payload.get("event")
    data = payload.get("data", {})

    if not isinstance(data, dict):
        data = {}

    logger.info("DocuSeal webhook (verified). event=%s", event_type)

    submission_id = _extract_submission_id(data)
    submission_status = _extract_submission_status(data)

    print(f"=== EXTRACTED ID ===: {submission_id}", flush=True)
    print(f"=== EXTRACTED STATUS ===: {submission_status}", flush=True)
    print(f"=== EXTRACTED DATA KEYS ===: {list(data.keys())}", flush=True)

    if event_type in COMPLETED_SUBMISSION_EVENTS:
        return _mark_contract_signed(submission_id, submission_status)

    if submission_status in {"completed", "complete"}:
        return _mark_contract_signed(submission_id, submission_status)

    return {"status": "ignored", "event": event_type}

import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.api.deps import get_current_user
from app.api.v1.templates import list_organization_templates, template_display_name
from app.core.config import settings
from app.core.database import supabase
from app.schemas.auth import CurrentUser

router = APIRouter()
DEBUG_LOG_PATH = Path(__file__).resolve().parents[3] / ".." / "debug-b806ce.log"


# region agent log
def _debug_log(run_id: str, hypothesis_id: str, location: str, message: str, data: dict[str, Any]) -> None:
    try:
        entry = {
            "sessionId": "b806ce",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with DEBUG_LOG_PATH.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# endregion


class CreateCandidateRequest(BaseModel):
    candidate_email: EmailStr
    candidate_name: str
    template_id: int
    require_id_scan: bool = True
    require_student_status: bool = False


class CandidateFormSubmitRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    pesel: str
    birth_date: str
    street: str
    house_number: str
    postal_code: str
    city: str


class DeleteCandidatesRequest(BaseModel):
    candidate_ids: list[str] | None = None
    delete_all: bool = False


def _split_candidate_name(candidate_name: str) -> tuple[str, str]:
    parts = candidate_name.strip().split()

    if not parts:
        return "", ""

    return parts[0], " ".join(parts[1:])


def _candidate_form_url(slug: str) -> str:
    return f"/f/{slug}"


def _load_agency_profile(organization_id: str) -> dict[str, Any]:
    try:
        organization_res = (
            supabase.table("organizations")
            .select("name, nip, address, phone, docuseal_template_id")
            .eq("id", organization_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось получить данные агентства. Ошибка: {str(exc)}",
        ) from exc

    if not organization_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Организация кандидата не найдена.",
        )

    organization = organization_res.data
    docuseal_template_id = organization.get("docuseal_template_id")

    if docuseal_template_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У агентства не настроен шаблон DocuSeal. Загрузите PDF в ustawieniach agencji.",
        )

    return {
        "docuseal_template_id": int(docuseal_template_id),
        "company_name": organization.get("name") or "",
        "nip": organization.get("nip") or "",
        "address": organization.get("address") or "",
    }


def _build_docuseal_values(
    payload: CandidateFormSubmitRequest,
    agency_profile: dict[str, Any],
) -> dict[str, str]:
    return {
        "Full Name": f"{payload.first_name} {payload.last_name}".strip(),
        "PESEL": payload.pesel,
        "Email": str(payload.email),
        "Phone": payload.phone,
        "Birth Date": payload.birth_date,
        "Address": f"{payload.street} {payload.house_number}, {payload.postal_code} {payload.city}".strip(),
        "Agency Name": agency_profile["company_name"],
        "Agency NIP": agency_profile["nip"],
        "Agency Address": agency_profile["address"],
    }


async def _create_docuseal_pdf_submission(
    payload: CandidateFormSubmitRequest,
    agency_profile: dict[str, Any],
) -> str:
    docuseal_payload = {
        "template_id": agency_profile["docuseal_template_id"],
        "send_email": True,
        "submitters": [
            {
                "role": "First Party",
                "email": str(payload.email),
                "name": f"{payload.first_name} {payload.last_name}".strip(),
                "values": _build_docuseal_values(payload, agency_profile),
            }
        ],
    }

    api_key = settings.DOCUSEAL_API_KEY.strip()
    headers = {
        "X-Auth-Token": api_key,
        "Content-Type": "application/json",
    }
    request_url = f"{settings.DOCUSEAL_API_URL.strip().rstrip('/')}/submissions"

    print(f"DEBUG: Sending request to {request_url} with token length {len(api_key)}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            request_url,
            headers=headers,
            json=docuseal_payload,
        )

    if response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
        print("❌ --- ОШИБКА ОТ DOCUSEAL ---")
        print(f"Код ответа: {response.status_code}")
        print(f"Текст ошибки: {response.text}")
        print("------------------------------")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"DocuSeal вернул ошибку: {response.status_code} {response.text}",
        )

    docuseal_data = response.json()
    if isinstance(docuseal_data, dict) and "id" in docuseal_data:
        return str(docuseal_data["id"])

    if isinstance(docuseal_data, list) and docuseal_data and "id" in docuseal_data[0]:
        return str(docuseal_data[0]["id"])

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="DocuSeal вернул неожиданный формат ответа.",
    )


@router.post("")
async def create_candidate_invitation(
    payload: CreateCandidateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    first_name, last_name = _split_candidate_name(payload.candidate_name)
    slug = secrets.token_urlsafe(16)

    _debug_log(
        "candidate-flow",
        "H1",
        "aether-backend/app/api/v1/candidates.py:create_candidate_invitation",
        "creating candidate invitation",
        {
            "hasOrganization": bool(current_user.organization_id),
            "templateId": payload.template_id,
            "emailDomain": str(payload.candidate_email).split("@")[-1],
        },
    )

    insert_res = (
        supabase.table("candidates")
        .insert({
            "organization_id": str(current_user.organization_id),
            "invited_by": str(current_user.id),
            "first_name": first_name,
            "last_name": last_name,
            "email": str(payload.candidate_email),
            "slug": slug,
            "status": "invited",
            "template_id": payload.template_id,
            "require_id_scan": payload.require_id_scan,
            "require_student_status": payload.require_student_status,
        })
        .execute()
    )

    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase не вернул созданного кандидата.",
        )

    candidate = insert_res.data[0]
    _debug_log(
        "candidate-flow",
        "H2",
        "aether-backend/app/api/v1/candidates.py:create_candidate_invitation",
        "candidate invitation created without docuseal submission",
        {
            "candidateId": candidate.get("id"),
            "status": candidate.get("status"),
            "hasSlug": bool(candidate.get("slug")),
        },
    )

    return {
        "id": candidate["id"],
        "slug": slug,
        "status": candidate["status"],
        "url": _candidate_form_url(slug),
    }


@router.post("/delete")
async def delete_candidates(
    payload: DeleteCandidatesRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    organization_id = str(current_user.organization_id)

    if payload.delete_all:
        deleted_count = _soft_delete_candidates(organization_id, delete_all=True)
        return {"status": "success", "deleted_count": deleted_count}

    if not payload.candidate_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podaj listę candidate_ids lub ustaw delete_all=true.",
        )

    deleted_count = _soft_delete_candidates(organization_id, candidate_ids=payload.candidate_ids)

    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono kandydatów do usunięcia.",
        )

    return {"status": "success", "deleted_count": deleted_count}


@router.delete("/{candidate_id}")
async def delete_candidate(
    candidate_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    deleted_count = _soft_delete_candidates(
        str(current_user.organization_id),
        candidate_ids=[candidate_id],
    )

    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kandydat nie został znaleziony.",
        )

    return {"status": "success", "deleted_count": deleted_count}


@router.post("/{slug}/submit")
async def submit_candidate_form(slug: str, payload: CandidateFormSubmitRequest):
    _debug_log(
        "candidate-flow",
        "H3",
        "aether-backend/app/api/v1/candidates.py:submit_candidate_form",
        "candidate submit started",
        {
            "slugLength": len(slug),
            "emailDomain": str(payload.email).split("@")[-1],
            "hasPesel": bool(payload.pesel),
        },
    )

    candidate_res = (
        supabase.table("candidates")
        .select("*")
        .eq("slug", slug)
        .is_("deleted_at", "null")
        .execute()
    )
    candidate = candidate_res.data[0] if candidate_res.data else None

    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formularz kandydata nie istnieje.")

    candidate_name = f"{payload.first_name} {payload.last_name}".strip()
    document_title = f"Договор для {candidate_name}"
    submitted_at = datetime.now(timezone.utc).isoformat()
    candidate_form_update = {
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": str(payload.email),
        "phone": payload.phone,
        "pesel": payload.pesel,
        "birth_date": payload.birth_date,
        "street": payload.street,
        "house_number": payload.house_number,
        "postal_code": payload.postal_code,
        "city": payload.city,
        "form_data": payload.model_dump(mode="json"),
        "submitted_at": submitted_at,
        "status": "submitted",
    }
    supabase.table("candidates").update(candidate_form_update).eq("id", candidate["id"]).execute()

    document_res = (
        supabase.table("documents")
        .insert({
            "organization_id": candidate["organization_id"],
            "created_by": candidate["invited_by"],
            "title": document_title,
            "candidate_name": candidate_name,
            "candidate_email": str(payload.email),
            "candidate_phone": payload.phone,
            "candidate_pesel": payload.pesel,
            "current_status": "pending",
            "form_filled_at": submitted_at,
        })
        .execute()
    )

    if not document_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase не вернул созданный документ.",
        )

    document = document_res.data[0]

    organization_id = str(candidate["organization_id"])
    agency_profile = _load_agency_profile(organization_id)

    try:
        docuseal_id = await _create_docuseal_pdf_submission(payload, agency_profile)
    except HTTPException:
        supabase.table("candidates").update({
            "status": "error",
            "document_id": document["id"],
        }).eq("id", candidate["id"]).execute()
        supabase.table("documents").update({"current_status": "error"}).eq("id", document["id"]).execute()
        raise
    except httpx.HTTPError as exc:
        supabase.table("candidates").update({
            "status": "error",
            "document_id": document["id"],
        }).eq("id", candidate["id"]).execute()
        supabase.table("documents").update({"current_status": "error"}).eq("id", document["id"]).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось подключиться к DocuSeal API: {str(exc)}",
        ) from exc
    except Exception as exc:
        supabase.table("candidates").update({
            "status": "error",
            "document_id": document["id"],
        }).eq("id", candidate["id"]).execute()
        supabase.table("documents").update({"current_status": "error"}).eq("id", document["id"]).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось отправить документ в DocuSeal: {str(exc)}",
        ) from exc

    sent_at = datetime.now(timezone.utc).isoformat()
    supabase.table("documents").update({
        "docuseal_id": docuseal_id,
        "current_status": "sent",
        "sent_at": sent_at,
    }).eq("id", document["id"]).execute()

    supabase.table("candidates").update({
        "status": "sent",
        "document_id": document["id"],
        "docuseal_id": docuseal_id,
    }).eq("id", candidate["id"]).execute()

    _debug_log(
        "candidate-flow",
        "H3",
        "aether-backend/app/api/v1/candidates.py:submit_candidate_form",
        "candidate submit completed and docuseal submission created",
        {
            "candidateId": candidate.get("id"),
            "documentId": document.get("id"),
            "hasDocusealId": bool(docuseal_id),
            "docusealTemplateId": agency_profile["docuseal_template_id"],
        },
    )

    return {
        "status": "success",
        "candidate_id": candidate["id"],
        "document_id": document["id"],
        "docuseal_id": docuseal_id,
    }


def _enrich_candidates_with_templates(
    candidates: list[dict[str, Any]],
    organization_id: str,
) -> list[dict[str, Any]]:
    templates = list_organization_templates(organization_id)
    templates_by_id = {template["id"]: template for template in templates}

    enriched: list[dict[str, Any]] = []

    for candidate in candidates:
        template_id = candidate.get("template_id")
        template = templates_by_id.get(template_id) if template_id is not None else None
        template_filename = template["filename"] if template else None
        candidate["template_name"] = (
            template_display_name(template_filename) if template_filename else None
        )
        candidate["template_filename"] = template_filename
        enriched.append(candidate)

    return enriched


def _soft_delete_candidates(
    organization_id: str,
    candidate_ids: list[str] | None = None,
    delete_all: bool = False,
) -> int:
    deleted_at = datetime.now(timezone.utc).isoformat()
    query = (
        supabase.table("candidates")
        .update({"deleted_at": deleted_at})
        .eq("organization_id", organization_id)
        .is_("deleted_at", "null")
    )

    if delete_all:
        result = query.execute()
        return len(result.data or [])

    if not candidate_ids:
        return 0

    unique_ids = list(dict.fromkeys(candidate_ids))
    result = query.in_("id", unique_ids).execute()
    return len(result.data or [])


@router.get("")
async def list_candidates(current_user: CurrentUser = Depends(get_current_user)):
    """
    Получение списка кандидатов строго для организации текущего рекрутера
    """
    result = (
        supabase.table("candidates")
        .select("*")
        .eq("organization_id", str(current_user.organization_id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    candidates = _enrich_candidates_with_templates(
        result.data or [],
        str(current_user.organization_id),
    )
    return {"candidates": candidates}

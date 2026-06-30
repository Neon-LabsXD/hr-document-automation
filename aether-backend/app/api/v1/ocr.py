import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.database import supabase

logger = logging.getLogger("app.ocr")

router = APIRouter()


def _load_candidate_by_slug(slug: str) -> dict:
    candidate_res = (
        supabase.table("candidates")
        .select(
            "first_name, last_name, email, phone, pesel, birth_date, "
            "street, house_number, postal_code, city, hourly_rate, form_data"
        )
        .eq("slug", slug)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )

    if not candidate_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Formularz kandydata nie istnieje.",
        )

    return candidate_res.data[0]


def _build_passport_prefill_response(candidate: dict) -> dict[str, str | None]:
    first_name = str(candidate.get("first_name") or "").strip()
    last_name = str(candidate.get("last_name") or "").strip()
    employee_name = f"{first_name} {last_name}".strip() or None

    street = str(candidate.get("street") or "").strip()
    house_number = str(candidate.get("house_number") or "").strip()
    postal_code = str(candidate.get("postal_code") or "").strip()
    city = str(candidate.get("city") or "").strip()
    address_parts = [part for part in [f"{street} {house_number}".strip(), postal_code, city] if part]
    employee_address = ", ".join(address_parts) or None

    pesel = str(candidate.get("pesel") or "").strip() or None

    return {
        "employee_name": employee_name,
        "employee_passport": None,
        "employee_address": employee_address,
        "pesel": pesel,
    }


@router.post("/scan-passport")
async def scan_passport(
    slug: str = Form(...),
    file: UploadFile | None = File(default=None),
):
    """
    OpenAI OCR removed — returns deterministic candidate data from Supabase.
    Uploaded file is accepted for UX compatibility but not sent to any LLM.
    """
    slug_value = slug.strip()
    if not slug_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak identyfikatora formularza (slug).",
        )

    if file is not None:
        logger.info(
            "scan-passport: file %s ignored (LLM OCR disabled), slug=%s",
            file.filename,
            slug_value,
        )

    candidate = _load_candidate_by_slug(slug_value)
    return _build_passport_prefill_response(candidate)

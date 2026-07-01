import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_current_user
from app.api.v1.templates import (
    list_organization_templates,
    resolve_docuseal_template_id,
    template_display_name,
)
from app.core.config import settings
from app.core.database import supabase
from app.schemas.auth import CurrentUser
from app.services.docuseal import (
    docuseal_api_url,
    docuseal_auth_headers,
    download_signed_submission_pdf,
    extract_docuseal_submission_id,
)
from app.services.email_service import EmailService, EmailServiceError
from app.services.candidate_passport_storage import store_candidate_passport_upload
from app.services.sms_service import SmsService

logger = logging.getLogger("app.candidates")

router = APIRouter()

# OTP-конфигурация для подтверждения личности кандидата по SMS перед отправкой формы.
OTP_CODE_TTL_SECONDS = 5 * 60          # код живёт 5 минут
OTP_MAX_ATTEMPTS = 5                    # максимум 5 попыток ввода кода
OTP_REQUEST_WINDOW_SECONDS = 60 * 60    # окно для rate-limit на отправку SMS
OTP_REQUEST_LIMIT_PER_WINDOW = 100      # TODO: вернуть 3 после E2E-тестов OTP
OTP_VERIFIED_TOKEN_TTL_SECONDS = 10 * 60  # токен подтверждения живёт 10 минут после ввода кода

# Beta: заглушка OTP — без SMSAPI, фиксированный код для закрытого тестирования.
# TODO: OTP_STUB_MODE = False перед продакшеном.
OTP_STUB_MODE = True
OTP_STUB_CODE = "123456"

# Статусы, при которых разрешены повторные действия в публичных эндпоинтах.
OTP_ALLOWED_STATUSES_FOR_REQUEST = {"invited", "otp_pending", "otp_verified"}
OTP_ALLOWED_STATUSES_FOR_VERIFY = {"otp_pending", "otp_verified"}
SUBMIT_ALLOWED_STATUSES = {"otp_verified"}

# Имя поля в конструкторе DocuSeal — должно совпадать с name в шаблоне.
DOCUSEAL_FIELD_HOURLY_RATE = "hourly_rate"


class CreateCandidateRequest(BaseModel):
    candidate_email: EmailStr
    # TODO: Modified for simplified email-only flow
    candidate_name: str | None = None
    phone: str | None = None
    template_id: int
    require_id_scan: bool = True
    require_student_status: bool = False


class CandidateFormSubmitRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=32)
    pesel: str = Field(min_length=11, max_length=11, pattern=r"^\d{11}$")
    birth_date: str = Field(min_length=1, max_length=32)
    hourly_rate: float = Field(gt=0, le=9999.99)
    street: str = Field(min_length=1, max_length=200)
    house_number: str = Field(min_length=1, max_length=32)
    postal_code: str = Field(min_length=1, max_length=16)
    city: str = Field(min_length=1, max_length=120)
    verification_token: str = Field(min_length=16, max_length=128)


class RequestOtpRequest(BaseModel):
    phone: str = Field(min_length=5, max_length=32)


class VerifyOtpRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10, pattern=r"^\d+$")


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


def _public_candidate_form_url(slug: str) -> str:
    return f"{settings.FRONTEND_URL}{_candidate_form_url(slug)}"


# region OTP helpers -------------------------------------------------------------


def _otp_secret_bytes() -> bytes:
    """Серверный ключ для HMAC хеширования OTP-кодов и verified-токенов."""
    secret = (settings.OTP_HMAC_SECRET or "").strip()
    if not secret:
        # Fallback на Supabase JWT secret — он тоже серверный и достаточно длинный.
        secret = (settings.SUPABASE_JWT_SECRET or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OTP secret is not configured on the server.",
        )
    return secret.encode("utf-8")


def _hash_otp_secret(value: str) -> str:
    """HMAC-SHA256(server_secret, value) — для безопасного хранения кода/токена."""
    return hmac.new(_otp_secret_bytes(), value.encode("utf-8"), hashlib.sha256).hexdigest()


def _generate_otp_code() -> str:
    """6-значный код, равномерно распределённый, через secrets.randbelow."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _generate_verified_token() -> str:
    return secrets.token_urlsafe(32)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _load_candidate_by_slug(slug: str) -> dict[str, Any]:
    candidate_res = (
        supabase.table("candidates")
        .select("*")
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


def _check_otp_rate_limit(candidate: dict[str, Any]) -> None:
    window_started_at = _parse_iso(candidate.get("otp_window_started_at"))
    request_count = int(candidate.get("otp_request_count") or 0)
    now = _now_utc()

    if (
        window_started_at
        and (now - window_started_at).total_seconds() < OTP_REQUEST_WINDOW_SECONDS
        and request_count >= OTP_REQUEST_LIMIT_PER_WINDOW
    ):
        retry_after_seconds = int(
            OTP_REQUEST_WINDOW_SECONDS - (now - window_started_at).total_seconds()
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Zbyt wiele żądań kodu SMS. Spróbuj ponownie za "
                f"{max(retry_after_seconds // 60, 1)} minut."
            ),
        )


def _update_candidate(candidate_id: str, payload: dict[str, Any]) -> None:
    supabase.table("candidates").update(payload).eq("id", candidate_id).execute()


# endregion ---------------------------------------------------------------------


def _hourly_rate_from_record(candidate: dict[str, Any]) -> str:
    form_data = candidate.get("form_data")
    if isinstance(form_data, dict):
        raw_rate = form_data.get("hourly_rate")
        if raw_rate is not None and str(raw_rate).strip():
            rate_text = str(raw_rate).strip()
            if "." in rate_text or "," in rate_text:
                return rate_text.replace(",", ".")
            return rate_text

    rate = candidate.get("hourly_rate")
    if rate is None or not str(rate).strip():
        return ""

    if isinstance(rate, (int, float)):
        numeric_rate = float(rate)
        if numeric_rate.is_integer():
            return str(int(numeric_rate))
        return str(rate)

    return str(rate).strip()


def _build_docuseal_values_from_record(candidate: dict[str, Any]) -> dict[str, str]:
    first_name = str(candidate.get("first_name") or "").strip()
    last_name = str(candidate.get("last_name") or "").strip()
    street = str(candidate.get("street") or "").strip()
    house_number = str(candidate.get("house_number") or "").strip()
    postal_code = str(candidate.get("postal_code") or "").strip()
    city = str(candidate.get("city") or "").strip()

    return {
        "Full Name": f"{first_name} {last_name}".strip(),
        "PESEL": str(candidate.get("pesel") or "").strip(),
        "Email": str(candidate.get("email") or "").strip(),
        "Phone": str(candidate.get("phone") or "").strip(),
        "Birth Date": str(candidate.get("birth_date") or "").strip(),
        "Address": (
            f"{street} {house_number}, {postal_code}, {city}"
        ).strip().strip(",").strip(),
        DOCUSEAL_FIELD_HOURLY_RATE: _hourly_rate_from_record(candidate),
    }


def _build_candidate_prefill_response(candidate: dict[str, Any]) -> dict[str, str | None]:
    first_name = str(candidate.get("first_name") or "").strip()
    last_name = str(candidate.get("last_name") or "").strip()
    street = str(candidate.get("street") or "").strip()
    house_number = str(candidate.get("house_number") or "").strip()
    postal_code = str(candidate.get("postal_code") or "").strip()
    city = str(candidate.get("city") or "").strip()

    return {
        "first_name": first_name or None,
        "last_name": last_name or None,
        "email": str(candidate.get("email") or "").strip() or None,
        "phone": str(candidate.get("phone") or "").strip() or None,
        "pesel": str(candidate.get("pesel") or "").strip() or None,
        "birth_date": str(candidate.get("birth_date") or "").strip() or None,
        "hourly_rate": _hourly_rate_from_record(candidate) or None,
        "street": street or None,
        "house_number": house_number or None,
        "postal_code": postal_code or None,
        "city": city or None,
    }


async def _create_docuseal_pdf_submission(
    candidate: dict[str, Any],
    docuseal_template_id: int,
) -> str:
    email = str(candidate.get("email") or "").strip()
    first_name = str(candidate.get("first_name") or "").strip()
    last_name = str(candidate.get("last_name") or "").strip()
    docuseal_payload = {
        "template_id": docuseal_template_id,
        "send_email": True,
        "submitters": [
            {
                "role": "First Party",
                "email": email,
                "name": f"{first_name} {last_name}".strip(),
                "values": _build_docuseal_values_from_record(candidate),
            }
        ],
    }

    headers = docuseal_auth_headers()
    request_url = docuseal_api_url("submissions")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            request_url,
            headers=headers,
            json=docuseal_payload,
        )

    if response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
        logger.error(
            "DocuSeal submissions endpoint returned status=%s",
            response.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DocuSeal вернул ошибку при создании заявки на подпись.",
        )

    docuseal_data = response.json()
    submission_id = extract_docuseal_submission_id(docuseal_data)
    logger.info(
        "DocuSeal submission created: submission_id=%s (raw_type=%s)",
        submission_id,
        type(docuseal_data).__name__,
    )
    return submission_id


@router.post("")
async def create_candidate_invitation(
    payload: CreateCandidateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    # TODO: Modified for simplified email-only flow
    candidate_name = (payload.candidate_name or "").strip()
    first_name, last_name = _split_candidate_name(candidate_name)
    phone = (payload.phone or "").strip() or None
    slug = secrets.token_urlsafe(16)

    insert_res = (
        supabase.table("candidates")
        .insert({
            "organization_id": str(current_user.organization_id),
            "invited_by": str(current_user.id),
            "first_name": first_name,
            "last_name": last_name,
            "email": str(payload.candidate_email),
            "phone": phone,
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
    public_form_url = _public_candidate_form_url(slug)

    try:
        await EmailService.send_invitation_email(str(payload.candidate_email), public_form_url)
    except EmailServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nie udało się wysłać zaproszenia e-mailem.",
        ) from exc

    if phone:
        await SmsService.send_invitation_sms(phone, public_form_url)

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


@router.get("/{candidate_id}/signed-document")
async def download_signed_document(
    candidate_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    candidate_res = (
        supabase.table("candidates")
        .select("id, status, docuseal_id, first_name, last_name, template_id")
        .eq("id", candidate_id)
        .eq("organization_id", str(current_user.organization_id))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )

    if not candidate_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kandydat nie został znaleziony.",
        )

    candidate = candidate_res.data[0]
    docuseal_id = candidate.get("docuseal_id")

    if not docuseal_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dla tego kandydata nie utworzono jeszcze zgłoszenia DocuSeal.",
        )

    candidate_status = str(candidate.get("status") or "").lower()
    if candidate_status != "signed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dokument nie został jeszcze podpisany.",
        )

    pdf_bytes, filename = await download_signed_submission_pdf(str(docuseal_id))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# region public candidate form ---------------------------------------------------


@router.get("/{slug}/prefill")
async def get_candidate_form_prefill(slug: str):
    """Возвращает сохранённые в Supabase данные кандидата без LLM/OCR."""
    candidate = _load_candidate_by_slug(slug)
    return _build_candidate_prefill_response(candidate)


@router.post("/{slug}/request-otp")
async def request_candidate_otp(slug: str, payload: RequestOtpRequest):
    """
    Публичный эндпоинт: кандидат запрашивает SMS-код для подтверждения личности.
    Защищён rate-limit'ом (3 SMS в час) и проверкой статуса кандидата.
    """
    candidate = _load_candidate_by_slug(slug)
    candidate_status = str(candidate.get("status") or "").lower()

    if candidate_status not in OTP_ALLOWED_STATUSES_FOR_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Ten formularz został już wypełniony i nie można go użyć ponownie.",
        )

    candidate_phone = (candidate.get("phone") or "").strip()
    # TODO: REMOVE IN PRODUCTION (BETA BYPASS FOR EMAIL-ONLY FLOW)
    skip_sms = not candidate_phone

    if not skip_sms:
        submitted_phone = payload.phone.strip().replace(" ", "")

        if candidate_phone.replace(" ", "") != submitted_phone:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Numer telefonu nie pasuje do zaproszenia.",
            )

    _check_otp_rate_limit(candidate)

    if OTP_STUB_MODE:
        code = OTP_STUB_CODE
    else:
        code = _generate_otp_code()

    code_hash = _hash_otp_secret(code)
    now = _now_utc()
    expires_at = now + timedelta(seconds=OTP_CODE_TTL_SECONDS)

    window_started_at = _parse_iso(candidate.get("otp_window_started_at"))
    request_count = int(candidate.get("otp_request_count") or 0)

    if (
        window_started_at
        and (now - window_started_at).total_seconds() < OTP_REQUEST_WINDOW_SECONDS
    ):
        new_request_count = request_count + 1
        new_window_started = window_started_at
    else:
        new_request_count = 1
        new_window_started = now

    _update_candidate(
        candidate["id"],
        {
            "status": "otp_pending",
            "otp_code_hash": code_hash,
            "otp_expires_at": _iso(expires_at),
            "otp_attempts_count": 0,
            "otp_verified_token_hash": None,
            "otp_verified_token_expires_at": None,
            "otp_window_started_at": _iso(new_window_started),
            "otp_request_count": new_request_count,
            "otp_last_sent_at": _iso(now),
        },
    )

    if skip_sms:
        logger.info(
            "OTP beta bypass: no phone on candidate %s, skipping SMS delivery",
            candidate["id"],
        )
    elif OTP_STUB_MODE:
        print(
            f"[OTP STUB] candidate={candidate['id']} "
            f"phone={candidate_phone} code={code}",
            flush=True,
        )
        logger.info(
            "OTP stub mode: skipping SMS, code=%s for candidate %s",
            code,
            candidate["id"],
        )
    else:
        sms_message = (
            f"Aether Flow: Twój kod weryfikacyjny to {code}. "
            "Kod jest ważny przez 5 minut."
        )

        try:
            await SmsService.send_raw_sms(candidate_phone, sms_message)
        except Exception:
            logger.exception("Failed to send OTP SMS to candidate %s.", candidate["id"])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Nie udało się wysłać SMS-a z kodem weryfikacyjnym.",
            )

    return {"status": "sent", "expires_in_seconds": OTP_CODE_TTL_SECONDS}


@router.post("/{slug}/verify-otp")
async def verify_candidate_otp(slug: str, payload: VerifyOtpRequest):
    """
    Публичный эндпоинт: проверка SMS-кода. После N=5 ошибок код инвалидируется.
    После успеха возвращается одноразовый verification_token, который кандидат
    обязан прислать в /submit.
    """
    candidate = _load_candidate_by_slug(slug)
    candidate_status = str(candidate.get("status") or "").lower()

    if candidate_status not in OTP_ALLOWED_STATUSES_FOR_VERIFY:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Brak aktywnego kodu weryfikacyjnego.",
        )

    stored_hash = candidate.get("otp_code_hash")
    expires_at = _parse_iso(candidate.get("otp_expires_at"))
    attempts = int(candidate.get("otp_attempts_count") or 0)

    if not stored_hash or not expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brak aktywnego kodu weryfikacyjnego.",
        )

    if _now_utc() > expires_at:
        _update_candidate(
            candidate["id"],
            {
                "otp_code_hash": None,
                "otp_expires_at": None,
                "otp_attempts_count": 0,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kod weryfikacyjny wygasł. Poproś o nowy.",
        )

    if attempts >= OTP_MAX_ATTEMPTS:
        _update_candidate(
            candidate["id"],
            {
                "otp_code_hash": None,
                "otp_expires_at": None,
                "otp_attempts_count": 0,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Przekroczono limit prób. Poproś o nowy kod.",
        )

    candidate_hash = _hash_otp_secret(payload.code)

    if not hmac.compare_digest(stored_hash, candidate_hash):
        _update_candidate(
            candidate["id"],
            {"otp_attempts_count": attempts + 1},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy kod weryfikacyjny.",
        )

    verification_token = _generate_verified_token()
    verification_token_hash = _hash_otp_secret(verification_token)
    verification_expires = _now_utc() + timedelta(seconds=OTP_VERIFIED_TOKEN_TTL_SECONDS)

    _update_candidate(
        candidate["id"],
        {
            "status": "otp_verified",
            "otp_code_hash": None,
            "otp_expires_at": None,
            "otp_attempts_count": 0,
            "otp_verified_token_hash": verification_token_hash,
            "otp_verified_token_expires_at": _iso(verification_expires),
        },
    )

    return {
        "status": "verified",
        "verification_token": verification_token,
        "expires_in_seconds": OTP_VERIFIED_TOKEN_TTL_SECONDS,
    }


@router.post("/{slug}/submit")
async def submit_candidate_form(
    slug: str,
    first_name: str = Form(..., min_length=1, max_length=100),
    last_name: str = Form(..., min_length=1, max_length=100),
    email: EmailStr = Form(...),
    phone: str = Form(..., min_length=1, max_length=32),
    pesel: str = Form(..., min_length=11, max_length=11, pattern=r"^\d{11}$"),
    birth_date: str = Form(..., min_length=1, max_length=32),
    hourly_rate: float = Form(..., gt=0, le=9999.99),
    street: str = Form(..., min_length=1, max_length=200),
    house_number: str = Form(..., min_length=1, max_length=32),
    postal_code: str = Form(..., min_length=1, max_length=16),
    city: str = Form(..., min_length=1, max_length=120),
    verification_token: str = Form(..., min_length=16, max_length=128),
    passport_file: UploadFile | None = File(default=None),
):
    """
    Публичный эндпоинт: отправка анкеты. Требует:
      1) валидный verification_token, выданный после прохождения OTP,
      2) статус кандидата = "otp_verified" (т.е. форма ещё не была отправлена).
    Повторный submit отдаёт 410 Gone.
    """
    payload = CandidateFormSubmitRequest(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        pesel=pesel,
        birth_date=birth_date,
        hourly_rate=hourly_rate,
        street=street,
        house_number=house_number,
        postal_code=postal_code,
        city=city,
        verification_token=verification_token,
    )
    candidate = _load_candidate_by_slug(slug)
    candidate_status = str(candidate.get("status") or "").lower()

    if candidate_status not in SUBMIT_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Ten formularz został już wypełniony lub wymaga weryfikacji SMS.",
        )

    stored_token_hash = candidate.get("otp_verified_token_hash")
    stored_token_expires = _parse_iso(candidate.get("otp_verified_token_expires_at"))

    if not stored_token_hash or not stored_token_expires:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Brak weryfikacji SMS. Wykonaj weryfikację jeszcze raz.",
        )

    if _now_utc() > stored_token_expires:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesja weryfikacji wygasła. Wykonaj weryfikację jeszcze raz.",
        )

    submitted_token_hash = _hash_otp_secret(payload.verification_token)
    if not hmac.compare_digest(stored_token_hash, submitted_token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy token weryfikacji.",
        )

    requires_passport_scan = bool(candidate.get("require_id_scan", True))
    has_passport_file = passport_file is not None and bool(passport_file.filename)

    if requires_passport_scan and not has_passport_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wymagany skan dowodu osobistego lub dokumentu tożsamości.",
        )

    candidate_id = str(candidate["id"])
    passport_path: str | None = None

    if has_passport_file and passport_file is not None:
        passport_path = await store_candidate_passport_upload(candidate_id, passport_file)
        if not passport_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Nie udało się zapisać skanu dokumentu tożsamości.",
            )

    candidate_name = f"{payload.first_name} {payload.last_name}".strip()
    document_title = f"Договор для {candidate_name}"
    submitted_at = _now_utc()
    submitted_at_iso = _iso(submitted_at)

    # Сразу после успешной валидации токена — переводим в "submitting", чтобы
    # повторные POST'ы с тем же токеном (network retry, double-click) попали в 410.
    invalidate_token_payload = {
        "status": "submitting",
        "otp_verified_token_hash": None,
        "otp_verified_token_expires_at": None,
    }
    update_res = (
        supabase.table("candidates")
        .update(invalidate_token_payload)
        .eq("id", candidate["id"])
        .eq("status", "otp_verified")
        .execute()
    )

    if not update_res.data:
        # Кто-то уже выиграл гонку — другой submit идёт прямо сейчас.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ten formularz jest właśnie wysyłany. Spróbuj ponownie za chwilę.",
        )

    candidate_form_update = {
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": str(payload.email),
        "phone": payload.phone,
        "pesel": payload.pesel,
        "birth_date": payload.birth_date,
        "hourly_rate": payload.hourly_rate,
        "street": payload.street,
        "house_number": payload.house_number,
        "postal_code": payload.postal_code,
        "city": payload.city,
        "form_data": {
            **payload.model_dump(mode="json", exclude={"verification_token"}),
            "hourly_rate": (
                str(int(payload.hourly_rate))
                if isinstance(payload.hourly_rate, float) and payload.hourly_rate.is_integer()
                else str(payload.hourly_rate)
            ),
        },
        "submitted_at": submitted_at_iso,
        "status": "submitted",
    }
    if passport_path:
        candidate_form_update["passport_path"] = passport_path

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
            "form_filled_at": submitted_at_iso,
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
    saved_candidate = {**candidate, **candidate_form_update}

    try:
        docuseal_template_id = resolve_docuseal_template_id(
            organization_id,
            candidate.get("template_id"),
        )
        hourly_rate = _hourly_rate_from_record(saved_candidate)
        if not hourly_rate:
            logger.warning(
                "DocuSeal prefill: hourly_rate is empty for candidate %s (template_id=%s)",
                candidate["id"],
                candidate.get("template_id"),
            )
        else:
            logger.info(
                "DocuSeal prefill: hourly_rate=%s for candidate %s",
                hourly_rate,
                candidate["id"],
            )
        docuseal_id = await _create_docuseal_pdf_submission(
            saved_candidate,
            docuseal_template_id,
        )
    except HTTPException:
        _update_candidate(
            candidate["id"],
            {"status": "error", "document_id": document["id"]},
        )
        supabase.table("documents").update({"current_status": "error"}).eq(
            "id", document["id"]
        ).execute()
        raise
    except httpx.HTTPError as exc:
        logger.exception("DocuSeal API connection failed during candidate submit.")
        _update_candidate(
            candidate["id"],
            {"status": "error", "document_id": document["id"]},
        )
        supabase.table("documents").update({"current_status": "error"}).eq(
            "id", document["id"]
        ).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось подключиться к DocuSeal API.",
        ) from exc
    except Exception:
        logger.exception("Unexpected error during candidate submit.")
        _update_candidate(
            candidate["id"],
            {"status": "error", "document_id": document["id"]},
        )
        supabase.table("documents").update({"current_status": "error"}).eq(
            "id", document["id"]
        ).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить документ в DocuSeal.",
        )

    sent_at = _iso(_now_utc())
    supabase.table("documents").update({
        "docuseal_id": docuseal_id,
        "current_status": "sent",
        "sent_at": sent_at,
    }).eq("id", document["id"]).execute()

    _update_candidate(
        candidate["id"],
        {
            "status": "sent",
            "document_id": document["id"],
            "docuseal_id": docuseal_id,
        },
    )

    return {
        "status": "success",
        "candidate_id": candidate["id"],
        "document_id": document["id"],
        "docuseal_id": docuseal_id,
        "passport_path": passport_path,
    }


# endregion ----------------------------------------------------------------------


def _enrich_candidates_with_document_timestamps(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    document_ids = [
        str(candidate["document_id"])
        for candidate in candidates
        if candidate.get("document_id")
    ]

    if not document_ids:
        return candidates

    documents_res = (
        supabase.table("documents")
        .select("id, sent_at, opened_at, otp_verified_at, signed_at")
        .in_("id", list(dict.fromkeys(document_ids)))
        .execute()
    )
    documents_by_id = {
        str(document["id"]): document for document in (documents_res.data or [])
    }

    for candidate in candidates:
        document_id = candidate.get("document_id")
        if not document_id:
            continue

        document = documents_by_id.get(str(document_id))
        if not document:
            continue

        candidate["sent_at"] = document.get("sent_at")
        candidate["opened_at"] = document.get("opened_at")
        candidate["otp_verified_at"] = document.get("otp_verified_at")
        candidate["signed_at"] = document.get("signed_at")

    return candidates


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
    deleted_at = _iso(_now_utc())
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
    Получение списка кандидатов строго для организации текущего рекрутера.
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
    candidates = _enrich_candidates_with_document_timestamps(candidates)
    return {"candidates": candidates}

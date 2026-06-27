import base64
import logging
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("app.docuseal")


def get_docuseal_api_key() -> str:
    api_key = settings.DOCUSEAL_API_KEY.strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DOCUSEAL_API_KEY nie jest skonfigurowany w pliku .env.",
        )

    return api_key


def docuseal_auth_headers(*, json_request: bool = True) -> dict[str, str]:
    headers = {
        "X-Auth-Token": get_docuseal_api_key(),
    }

    if json_request:
        headers["Content-Type"] = "application/json"

    return headers


def docuseal_api_url(path: str) -> str:
    return f"{settings.DOCUSEAL_API_URL.strip().rstrip('/')}/{path.lstrip('/')}"


def docuseal_web_base_url() -> str:
    host = docuseal_builder_host()
    return f"https://{host}" if host else settings.DOCUSEAL_API_URL.strip().rstrip("/").removesuffix("/api")


def docuseal_builder_host() -> str | None:
    api_url = settings.DOCUSEAL_API_URL.strip().lower()

    if "docuseal.eu" in api_url:
        return "docuseal.eu"

    if "docuseal.com" in api_url:
        return "docuseal.com"

    return None


def create_builder_token(
    *,
    recruiter_email: str,
    template_id: int,
    template_name: str | None = None,
    external_id: str | None = None,
) -> str:
    admin_email = settings.DOCUSEAL_USER_EMAIL.strip()

    if not admin_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DOCUSEAL_USER_EMAIL nie jest skonfigurowany na serwerze.",
        )

    payload: dict[str, Any] = {
        "user_email": admin_email,
        "integration_email": recruiter_email,
        "template_id": int(template_id),
    }

    if template_name:
        payload["name"] = template_name

    if external_id:
        payload["external_id"] = external_id

    token = jwt.encode(
        payload,
        get_docuseal_api_key(),
        algorithm="HS256",
    )

    return token if isinstance(token, str) else token.decode("utf-8")


def parse_docuseal_template_response(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("id") is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DocuSeal вернул неожиданный формат ответа при создании шаблона.",
        )

    template_id = int(data["id"])
    edit_url = data.get("edit_url")

    if not edit_url and data.get("slug"):
        edit_url = f"{docuseal_web_base_url()}/templates/{data['slug']}/edit"

    return {
        "id": template_id,
        "edit_url": edit_url,
    }


async def create_docuseal_template_from_pdf(
    file_content: bytes,
    filename: str,
    *,
    template_name: str | None = None,
    external_id: str | None = None,
) -> dict[str, Any]:
    request_url = docuseal_api_url("templates/pdf")
    payload: dict[str, Any] = {
        "name": template_name or filename.rsplit(".", 1)[0],
        "documents": [
            {
                "name": filename,
                "file": base64.b64encode(file_content).decode("ascii"),
            }
        ],
    }

    if external_id:
        payload["external_id"] = external_id

    async with httpx.AsyncClient(timeout=120.0) as client:
        headers = {
            "X-Auth-Token": get_docuseal_api_key(),
            "Content-Type": "application/json",
        }
        response = await client.post(
            request_url,
            headers=headers,
            json=payload,
        )

    if response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
        logger.error(
            "DocuSeal templates/pdf returned status=%s",
            response.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DocuSeal не смог создать шаблон. Попробуйте ещё раз.",
        )

    return parse_docuseal_template_response(response.json())


async def fetch_submission_documents(
    submission_id: str,
    *,
    merge: bool = True,
) -> list[dict[str, Any]]:
    params = {"merge": "true"} if merge else {}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            docuseal_api_url(f"submissions/{submission_id}/documents"),
            headers=docuseal_auth_headers(json_request=False),
            params=params,
        )

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podpisany dokument nie został jeszcze znaleziony w DocuSeal.",
        )

    if response.status_code != status.HTTP_200_OK:
        logger.error(
            "DocuSeal submissions/documents returned status=%s",
            response.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DocuSeal nie zwrócił dokumentów.",
        )

    payload = response.json()
    documents = payload.get("documents") if isinstance(payload, dict) else payload

    if not isinstance(documents, list) or not documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Brak gotowych dokumentów PDF dla tego zgłoszenia.",
        )

    return [document for document in documents if isinstance(document, dict)]


async def download_signed_submission_pdf(submission_id: str) -> tuple[bytes, str]:
    documents = await fetch_submission_documents(submission_id, merge=True)
    document = documents[0]
    download_url = document.get("url")

    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DocuSeal nie zwrócił adresu URL do pobrania podpisanego PDF.",
        )

    filename = str(document.get("name") or "signed_document.pdf")
    if not filename.lower().endswith(".pdf"):
        filename = f"{filename}.pdf"

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        pdf_response = await client.get(str(download_url))

    if pdf_response.status_code != status.HTTP_200_OK:
        logger.error("Signed PDF download failed status=%s", pdf_response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nie udało się pobrać podpisanego PDF.",
        )

    return pdf_response.content, filename

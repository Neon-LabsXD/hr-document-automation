import base64
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, status

from app.core.config import settings


def docuseal_auth_headers(*, json_request: bool = True) -> dict[str, str]:
    headers = {"X-Auth-Token": settings.DOCUSEAL_API_KEY.strip()}
    if json_request:
        headers["Content-Type"] = "application/json"
    return headers


def docuseal_api_url(path: str) -> str:
    return f"{settings.DOCUSEAL_API_URL.strip().rstrip('/')}/{path.lstrip('/')}"


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
        settings.DOCUSEAL_API_KEY.strip(),
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
        edit_url = f"https://docuseal.com/templates/{data['slug']}/edit"

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

    print(f"DEBUG: Creating DocuSeal template at {request_url}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            request_url,
            headers=docuseal_auth_headers(),
            json=payload,
        )

    if response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
        print("❌ --- ОШИБКА ОТ DOCUSEAL (TEMPLATE) ---")
        print(f"Код ответа: {response.status_code}")
        print(f"Текст ошибки: {response.text}")
        print("--------------------------------------")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"DocuSeal не смог создать шаблон: {response.status_code} {response.text}",
        )

    return parse_docuseal_template_response(response.json())

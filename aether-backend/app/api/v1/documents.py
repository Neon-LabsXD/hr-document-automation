from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import supabase
from app.schemas.auth import CurrentUser
from app.services.document_service import (
    DocumentGenerationError,
    PDF_MEDIA_TYPE,
    generate_tenant_document,
)

router = APIRouter()


class GenerateDocumentRequest(BaseModel):
    template_name: str
    data: dict


class SendDocumentRequest(BaseModel):
    template_id: int
    candidate_email: EmailStr
    candidate_name: str


def _download_filename(template_name: str) -> str:
    safe_name = (template_name or "").replace("\\", "/").split("/")[-1]
    stem = Path(safe_name).stem or "contract"
    return f"filled_{stem}.pdf"


@router.post("/generate")
async def generate_document(
    payload: GenerateDocumentRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        generated_path = generate_tenant_document(
            organization_id=str(current_user.organization_id),
            template_name=payload.template_name,
            context=payload.data,
        )
    except DocumentGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    filename = _download_filename(payload.template_name)

    return FileResponse(
        path=generated_path,
        media_type=PDF_MEDIA_TYPE,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _mark_document_as_error(document_id: str) -> None:
    try:
        supabase.table("documents").update({"current_status": "error"}).eq("id", document_id).execute()
    except Exception:
        pass


@router.post("/send", tags=["Documents"])
async def send_document(
    payload: SendDocumentRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    document_id: str | None = None

    try:
        document_title = f"Договор для {payload.candidate_name}"
        insert_res = (
            supabase.table("documents")
            .insert({
                "organization_id": str(current_user.organization_id),
                "candidate_email": str(payload.candidate_email),
                "candidate_name": payload.candidate_name,
                "created_by": str(current_user.id),
                "title": document_title,
                "current_status": "sent",
            })
            .execute()
        )

        if not insert_res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase не вернул созданный документ.",
            )

        created_document = insert_res.data[0]
        document_id = created_document.get("id") or created_document.get("uuid")

        if not document_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="В созданной строке documents отсутствует UUID.",
            )

        docuseal_payload = {
            "template_id": payload.template_id,
            "send_email": True,
            "submitters": [
                {
                    "role": "Signer",
                    "email": str(payload.candidate_email),
                    "name": payload.candidate_name,
                }
            ],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.DOCUSEAL_API_URL.rstrip('/')}/submissions",
                headers={
                    "X-Auth-Token": settings.DOCUSEAL_API_KEY,
                    "Content-Type": "application/json",
                },
                json=docuseal_payload,
            )

        if response.status_code != status.HTTP_200_OK:
            await _mark_document_as_error(str(document_id))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"DocuSeal вернул ошибку: {response.status_code} {response.text}",
            )

        docuseal_data = response.json()
        if not isinstance(docuseal_data, list) or not docuseal_data or "id" not in docuseal_data[0]:
            await _mark_document_as_error(str(document_id))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="DocuSeal вернул неожиданный формат ответа.",
            )

        docuseal_id = docuseal_data[0]["id"]

        supabase.table("documents").update({"docuseal_id": str(docuseal_id)}).eq(
            "id",
            str(document_id),
        ).execute()

        return {
            "status": "success",
            "document_id": str(document_id),
            "docuseal_id": docuseal_id,
        }
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        if document_id:
            await _mark_document_as_error(str(document_id))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось подключиться к DocuSeal API: {str(exc)}",
        ) from exc
    except Exception as exc:
        if document_id:
            await _mark_document_as_error(str(document_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось отправить документ на подпись: {str(exc)}",
        ) from exc

import httpx

from app.services.docuseal import docuseal_api_url, docuseal_auth_headers


class SignatureServiceError(Exception):
    pass


async def send_contract_from_template(
    template_id: int,
    employee_email: str,
    employee_name: str,
    prefill_data: dict | None = None,
) -> dict:
    """
    Создает заявку на подпись в DocuSeal из заранее настроенного шаблона.
    """
    if not template_id:
        raise SignatureServiceError("template_id обязателен для отправки договора в DocuSeal.")

    payload = {
        "name": f"Контракт для {employee_name}",
        "template_id": template_id,
        "send_email": True,
        "submitters": [
            {
                "name": employee_name,
                "email": employee_email,
                "role": "Signer1",
                "values": prefill_data or {},
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                docuseal_api_url("submissions"),
                headers=docuseal_auth_headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise SignatureServiceError(
            "DocuSeal вернул ошибку при создании заявки на подпись: "
            f"{exc.response.status_code} {exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise SignatureServiceError(
            f"Не удалось подключиться к DocuSeal API. Ошибка: {str(exc)}"
        ) from exc
    except Exception as exc:
        raise SignatureServiceError(
            f"Не удалось отправить контракт в DocuSeal. Ошибка: {str(exc)}"
        ) from exc

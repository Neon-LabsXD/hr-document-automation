import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SMS_API_URL = "https://api.smsapi.pl/sms.do"
INVITATION_MESSAGE_TEMPLATE = (
    "Cześć! Twoja agencja przygotowała umowę do uzupełnienia. "
    "Kliknij w link, aby przejść do formularza: {url}"
)


class SmsServiceError(Exception):
    pass


class SmsService:
    @staticmethod
    async def _send(to_phone: str, message: str) -> bool:
        auth_token = (settings.SMSAPI_OAUTH_TOKEN or "").strip()
        sender_name = (settings.SMSAPI_FROM_NAME or "Test").strip()
        normalized_phone = to_phone.strip().replace(" ", "")

        if not auth_token:
            logger.error("SMSAPI_OAUTH_TOKEN is not configured")
            raise SmsServiceError("SMS provider is not configured")

        if not normalized_phone:
            logger.warning("Cannot send SMS: phone number is empty")
            raise SmsServiceError("Empty phone number")

        headers = {
            "Authorization": f"Bearer {auth_token}",
        }
        params = {
            "to": normalized_phone,
            "message": message,
            "from": sender_name,
            "format": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(SMS_API_URL, headers=headers, params=params)
        except httpx.HTTPError as exc:
            logger.error("SMSAPI request failed: %s", type(exc).__name__)
            raise SmsServiceError("SMS provider request failed") from exc

        if response.status_code != 200:
            logger.error("SMSAPI returned HTTP %s", response.status_code)
            raise SmsServiceError(f"SMS provider returned HTTP {response.status_code}")

        try:
            payload = response.json()
        except ValueError as exc:
            logger.error("SMSAPI returned non-JSON response.")
            raise SmsServiceError("SMS provider returned invalid response") from exc

        if isinstance(payload, dict) and "error" in payload:
            error = payload["error"]
            error_code = error.get("code") if isinstance(error, dict) else error
            logger.error("SMSAPI error code: %s", error_code)
            raise SmsServiceError(f"SMS provider error code: {error_code}")

        logger.info("SMS sent to %s", normalized_phone)
        return True

    @staticmethod
    async def send_invitation_sms(to_phone: str, url: str) -> bool:
        message = INVITATION_MESSAGE_TEMPLATE.format(url=url)
        try:
            return await SmsService._send(to_phone, message)
        except SmsServiceError:
            return False

    @staticmethod
    async def send_raw_sms(to_phone: str, message: str) -> bool:
        """Отправляет произвольный текст. Бросает SmsServiceError при ошибке —
        нужно для OTP-flow, где факт неотправки SMS критичен."""
        return await SmsService._send(to_phone, message)

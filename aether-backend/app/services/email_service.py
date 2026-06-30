import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)

INVITATION_EMAIL_SUBJECT = "Zaproszenie do formularza"
INVITATION_EMAIL_BODY_TEMPLATE = (
    "Cześć!\n\n"
    "Twoja agencja przygotowała umowę do uzupełnienia. "
    "Kliknij w link, aby przejść do formularza:\n\n"
    "{url}\n"
)


class EmailServiceError(Exception):
    pass


class EmailService:
    @staticmethod
    def _send_sync(to_email: str, subject: str, body: str) -> None:
        recipient = to_email.strip()
        smtp_user = str(settings.SMTP_USER).strip()
        smtp_password = (settings.SMTP_PASSWORD or "").strip()

        if not recipient:
            raise EmailServiceError("Empty recipient email")

        if not smtp_user or not smtp_password:
            logger.error("SMTP credentials are not configured")
            raise EmailServiceError("SMTP is not configured")

        message = EmailMessage()
        message["From"] = smtp_user
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)

        try:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
                smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
        except smtplib.SMTPException as exc:
            logger.error("SMTP send failed: %s", type(exc).__name__)
            raise EmailServiceError("SMTP send failed") from exc

        logger.info("Invitation email sent to %s", recipient)

    @staticmethod
    async def send_invitation_email(to_email: str, url: str) -> bool:
        # TODO: Modified for simplified email-only flow
        body = INVITATION_EMAIL_BODY_TEMPLATE.format(url=url)
        await asyncio.to_thread(
            EmailService._send_sync,
            to_email,
            INVITATION_EMAIL_SUBJECT,
            body,
        )
        return True

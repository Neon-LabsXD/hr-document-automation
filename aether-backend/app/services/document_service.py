import subprocess
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from docxtpl import DocxTemplate

from app.core.database import supabase

STORAGE_BUCKET = "agency-files"
PDF_MEDIA_TYPE = "application/pdf"


class DocumentGenerationError(Exception):
    pass


def _safe_docx_filename(filename: str) -> str:
    safe_name = (filename or "").replace("\\", "/").split("/")[-1]

    if not safe_name.lower().endswith(".docx"):
        raise DocumentGenerationError("Шаблон должен быть файлом .docx.")

    return safe_name


def generate_tenant_document(
    organization_id: str,
    template_name: str,
    context: dict,
) -> str:
    """
    Генерирует PDF-документ из DOCX-шаблона организации и возвращает абсолютный путь к файлу.
    """
    safe_template_name = _safe_docx_filename(template_name)
    template_path = f"{organization_id}/templates/{safe_template_name}"

    try:
        template_content = supabase.storage.from_(STORAGE_BUCKET).download(template_path)
    except Exception as exc:
        # Добавляем реальный текст ошибки, чтобы сразу увидеть её в Swagger
        raise DocumentGenerationError(
            f"Не удалось скачать шаблон из Supabase Storage. Ошибка: {str(exc)}"
        ) from exc

    try:
        doc = DocxTemplate(BytesIO(template_content))
        doc.render(context)

        generated_dir = Path(__file__).resolve().parents[1] / "generated_docs"
        generated_dir.mkdir(parents=True, exist_ok=True)

        output_path = generated_dir / f"{Path(safe_template_name).stem}_{uuid4().hex}.docx"
        doc.save(output_path)
    except Exception as exc:
        # Раскрываем внутреннюю ошибку docxtpl или файловой системы
        raise DocumentGenerationError(
            f"Не удалось сгенерировать документ. Ошибка: {str(exc)}"
        ) from exc

    try:
        pdf_output_path = output_path.with_suffix(".pdf")
        libreoffice_path = Path("C:/Program Files/LibreOffice/program/soffice.exe")
        soffice_path = str(libreoffice_path) if libreoffice_path.exists() else "soffice"

        cmd = [
            soffice_path,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(generated_dir),
            str(output_path),
        ]
        subprocess.run(cmd, check=True)

        if not pdf_output_path.exists():
            raise DocumentGenerationError(
                f"LibreOffice завершил работу, но PDF-файл не был создан: {pdf_output_path}"
            )
    except FileNotFoundError as exc:
        raise DocumentGenerationError(
            "LibreOffice не найден. Установите LibreOffice или добавьте команду soffice в PATH."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise DocumentGenerationError(
            f"LibreOffice не смог конвертировать документ в PDF. Ошибка: {str(exc)}"
        ) from exc
    except DocumentGenerationError:
        raise
    except Exception as exc:
        raise DocumentGenerationError(
            f"Не удалось конвертировать документ в PDF. Ошибка: {str(exc)}"
        ) from exc

    return str(pdf_output_path.resolve())

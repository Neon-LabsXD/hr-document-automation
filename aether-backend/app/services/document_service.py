from pathlib import Path

from app.core.database import supabase

STORAGE_BUCKET = "agency-files"
PDF_MEDIA_TYPE = "application/pdf"

_DEPRECATED_GENERATION_MESSAGE = (
    "Локальная генерация DOCX/PDF отключена. Используйте DocuSeal Template ID."
)


class DocumentGenerationError(Exception):
    pass


def _safe_docx_filename(filename: str) -> str:
    safe_name = (filename or "").replace("\\", "/").split("/")[-1]

    if not safe_name.lower().endswith(".docx"):
        raise DocumentGenerationError("Шаблон должен быть файлом .docx.")

    return safe_name


def _generated_dir() -> Path:
    generated_dir = Path(__file__).resolve().parents[1] / "generated_docs"
    generated_dir.mkdir(parents=True, exist_ok=True)
    return generated_dir


def _template_path(organization_id: str, template_name: str) -> str:
    return f"{organization_id}/templates/{_safe_docx_filename(template_name)}"


def _list_template_filenames(organization_id: str) -> list[str]:
    try:
        storage_items = supabase.storage.from_(STORAGE_BUCKET).list(f"{organization_id}/templates")
    except Exception as exc:
        raise DocumentGenerationError(
            f"Не удалось получить список шаблонов из Supabase Storage. Ошибка: {str(exc)}"
        ) from exc

    filenames = [
        str(item.get("name"))
        for item in storage_items or []
        if item.get("name")
        and not str(item.get("name")).startswith(".")
        and str(item.get("name")).lower().endswith(".docx")
    ]

    return sorted(filenames, key=str.lower)


def resolve_template_filename(organization_id: str, template_id: int | str | None) -> str:
    filenames = _list_template_filenames(organization_id)

    if not filenames:
        raise DocumentGenerationError("У организации нет загруженных DOCX-шаблонов.")

    template_id_value = str(template_id or "").strip()
    if template_id_value:
        exact_candidates = {
            f"{template_id_value}.docx",
            f"template_{template_id_value}.docx",
            f"szablon_{template_id_value}.docx",
        }
        for filename in filenames:
            if filename.lower() in {candidate.lower() for candidate in exact_candidates}:
                return filename

        if template_id_value.isdigit():
            template_index = int(template_id_value) - 1
            if 0 <= template_index < len(filenames):
                return filenames[template_index]

    if len(filenames) == 1:
        return filenames[0]

    raise DocumentGenerationError(
        "Не удалось однозначно сопоставить template_id с загруженным DOCX-шаблоном."
    )


def download_template_content(organization_id: str, template_name: str) -> bytes:
    template_path = _template_path(organization_id, template_name)

    try:
        return supabase.storage.from_(STORAGE_BUCKET).download(template_path)
    except Exception as exc:
        raise DocumentGenerationError(
            f"Не удалось скачать шаблон из Supabase Storage. Ошибка: {str(exc)}"
        ) from exc


def render_template_to_docx(
    template_content: bytes,
    template_name: str,
    context: dict,
) -> Path:
    raise DocumentGenerationError(_DEPRECATED_GENERATION_MESSAGE)


def convert_docx_to_pdf(docx_path: Path) -> Path:
    raise DocumentGenerationError(_DEPRECATED_GENERATION_MESSAGE)


def get_generated_docs_dir() -> Path:
    return _generated_dir()


def convert_agency_template_to_pdf(organization_id: str, template_name: str) -> tuple[Path, Path]:
    raise DocumentGenerationError(_DEPRECATED_GENERATION_MESSAGE)


def generate_tenant_document_files(
    organization_id: str,
    template_name: str,
    context: dict,
) -> tuple[Path, Path]:
    raise DocumentGenerationError(_DEPRECATED_GENERATION_MESSAGE)


def generate_tenant_document(
    organization_id: str,
    template_name: str,
    context: dict,
) -> str:
    raise DocumentGenerationError(_DEPRECATED_GENERATION_MESSAGE)

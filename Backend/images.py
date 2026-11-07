import base64
import uuid

from config import UPLOADS_DIR

MIME_TYPES = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}


def detect_image_type(data):
    """מזהה את סוג התמונה לפי הבתים הראשונים של הקובץ, ולא לפי השם או מה שהדפדפן טוען."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def save_image(data, extension):
    """שומר תמונה בשם אקראי, ומחזיר את הנתיב שנשמר ב-DB."""
    name = f"{uuid.uuid4().hex}.{extension}"
    (UPLOADS_DIR / name).write_bytes(data)
    return f"/uploads/{name}"


def image_file(image_path):
    return UPLOADS_DIR / image_path.removeprefix("/uploads/")


def image_exists(image_path):
    return image_file(image_path).is_file()


def delete_image(image_path):
    image_file(image_path).unlink(missing_ok=True)


def image_to_base64(image_path):
    """התמונה כ-base64 וסוג ה-MIME שלה, כדי לשלוח אותה למודל."""
    path = image_file(image_path)
    return base64.b64encode(path.read_bytes()).decode("ascii"), MIME_TYPES[path.suffix[1:]]

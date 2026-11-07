import os
from pathlib import Path
from dotenv import load_dotenv

# טעינת Backend/.env במקום אחד. שאר הקוד מייבא מכאן.
load_dotenv(Path(__file__).parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-6-luna")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1-mini")

# תמונות שהמשתמשים מעלים או שהסוכן יוצר. ב-DB נשמר רק הנתיב.
UPLOADS_DIR = Path(__file__).parent / "uploads"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "chat_db")

# הסוד שחותם את הטוקנים. סוד חסר, קצר או ציבורי (מקובץ הדוגמה) מאפשר לזייף טוקן, אז השרת לא עולה.
JWT_SECRET = os.getenv("JWT_SECRET", "")
if len(JWT_SECRET) < 32 or JWT_SECRET.startswith("change-me"):
    raise RuntimeError(
        "Set JWT_SECRET in Backend/.env to a random string of at least 32 characters. "
        'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
    )

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

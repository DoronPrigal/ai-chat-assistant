import os
from pathlib import Path
from dotenv import load_dotenv

# טעינת Backend/.env במקום אחד. שאר הקוד מייבא מכאן.
load_dotenv(Path(__file__).parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-6-luna")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "chat_db")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET in Backend/.env is missing or shorter than 32 characters")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

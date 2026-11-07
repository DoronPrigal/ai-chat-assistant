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

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

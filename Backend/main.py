from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_URL
from db.database import get_db, create_tables
from routes import conversations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # רץ פעם אחת כשהשרת עולה
    create_tables()
    yield


app = FastAPI(title="AI Chat Assistant API", lifespan=lifespan)

# רק ה-Frontend שלנו רשאי לפנות ל-API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations.router)


@app.get("/api/health")
def health():
    """בדיקה שהשרת עובד ושיש חיבור ל-DB."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    cursor.fetchone()
    cursor.close()
    conn.close()
    return {"status": "ok", "database": "connected"}

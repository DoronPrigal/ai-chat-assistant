import logging
from contextlib import asynccontextmanager

import mysql.connector
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import FRONTEND_URL, UPLOADS_DIR
from db.database import get_db, create_tables
from routes import auth, conversations, uploads

# לוג של השרת: שגיאות (למשל של OpenAI) נרשמות כאן עם הפרטים המלאים
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


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

# שגיאת ולידציה (422): מחזירים מה לא תקין, בלי הערך שנשלח (input), כדי שסיסמה לא תוחזר בתשובה
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


app.include_router(auth.router)
app.include_router(conversations.router)
app.include_router(uploads.router)

# התמונות מוגשות בכתובת /uploads/<שם אקראי>. שם הקובץ אקראי ולא ניתן לניחוש.
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/api/health")
def health():
    """בדיקה שהשרת עובד ושיש חיבור ל-DB."""
    try:
        conn = get_db()
    except mysql.connector.Error:
        raise HTTPException(status_code=503, detail="The database is not available")
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    cursor.fetchone()
    cursor.close()
    conn.close()
    return {"status": "ok", "database": "connected"}

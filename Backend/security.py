from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET
from db import users_db

ALGORITHM = "HS256"
TOKEN_DAYS = 7  # כמה זמן המשתמש נשאר מחובר

# קורא את הכותרת Authorization: Bearer <token>
bearer = HTTPBearer(auto_error=False)


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password, password_hash):
    # bcrypt מוגבל ל-72 בתים. סיסמה ארוכה יותר לא יכולה להיות נכונה.
    if len(password.encode("utf-8")) > 72:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# hash קבוע לבדיקה כשהמשתמש לא קיים, כדי שזמן התגובה יהיה דומה (ראו routes/auth.py)
DUMMY_HASH = hash_password("not-a-real-password")


def create_token(user_id):
    payload = {
        "sub": str(user_id),  # PyJWT דורש ש-sub יהיה מחרוזת
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    """Dependency: מחזיר את המשתמש המחובר לפי הטוקן, ו-401 אם אין טוקן תקין."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Please log in", headers={"WWW-Authenticate": "Bearer"})
    try:
        # require: טוקן בלי תאריך תפוגה או בלי מזהה משתמש נדחה
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM],
                             options={"require": ["exp", "sub"]})
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.",
                            headers={"WWW-Authenticate": "Bearer"})

    user = users_db.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Please log in", headers={"WWW-Authenticate": "Bearer"})
    return user

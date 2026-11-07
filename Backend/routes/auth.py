from fastapi import APIRouter, Depends, HTTPException

from db import users_db
from models.user_models import UserCreate, UserLogin, UserOut, AuthResponse
from security import hash_password, verify_password, create_token, get_current_user, DUMMY_HASH

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: UserCreate):
    """הרשמה. מחזירה טוקן, כך שהמשתמש מחובר מיד."""
    user = users_db.create_user(body.username, hash_password(body.password))
    return {"access_token": create_token(user["id"]), "user": user}


@router.post("/login", response_model=AuthResponse)
def login(body: UserLogin):
    user = users_db.get_user_by_username(body.username)
    # אותה הודעה ואותו זמן תגובה לשם שגוי ולסיסמה שגויה: גם כשהמשתמש לא קיים
    # מריצים בדיקת bcrypt (על hash מדומה), כי bcrypt איטי בכוונה
    password_hash = user["password_hash"] if user else DUMMY_HASH
    password_ok = verify_password(body.password, password_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return {"access_token": create_token(user["id"]), "user": user}


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return current_user

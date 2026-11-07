from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

# שם משתמש: 3 עד 30 תווים, אותיות, ספרות, נקודה, מקף וקו תחתון. רווחים בקצוות נמחקים.
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=30, pattern=r"^[\w.-]+$")]


class UserCreate(BaseModel):
    username: Username
    password: str = Field(min_length=6)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value):
        # bcrypt מוגבל ל-72 בתים (אות בעברית תופסת 2 בתים)
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        return value


class UserLogin(BaseModel):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

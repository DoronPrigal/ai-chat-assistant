from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

# רק נתיב של תמונה שהשרת שמר בעצמו (שם אקראי בתיקיית uploads). מונע גישה לקבצים אחרים בשרת.
IMAGE_PATH_PATTERN = r"^/uploads/[0-9a-f]{32}\.(png|jpg|webp|gif)$"


class MessageCreate(BaseModel):
    """גוף הבקשה לשליחת הודעה: טקסט, תמונה (נתיב מ-/api/uploads), או שניהם."""
    model_config = ConfigDict(str_strip_whitespace=True)
    content: str = Field(default="", max_length=8000)
    image_path: str | None = Field(default=None, pattern=IMAGE_PATH_PATTERN)

    @model_validator(mode="after")
    def text_or_image(self):
        if not self.content and not self.image_path:
            raise ValueError("Write a message or attach an image")
        return self


class UploadOut(BaseModel):
    image_path: str


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: Literal["user", "assistant"]
    content: str
    image_path: str | None = None
    created_at: datetime


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class SendMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut


class NewConversationResponse(SendMessageResponse):
    conversation: ConversationOut

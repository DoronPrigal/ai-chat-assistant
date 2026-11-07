from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    """גוף הבקשה לשליחת הודעה. רווחים בקצוות נמחקים, והודעה ריקה נדחית."""
    model_config = ConfigDict(str_strip_whitespace=True)
    content: str = Field(min_length=1, max_length=8000)


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
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

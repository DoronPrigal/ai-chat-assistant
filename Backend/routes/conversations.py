from fastapi import APIRouter, Depends, HTTPException

from db import conversations_db, messages_db
from models.conversation_models import (
    MessageCreate, ConversationOut, ConversationDetail, SendMessageResponse, NewConversationResponse,
)
from agent.graph import get_reply
from security import get_current_user

# כל ה-Endpoints כאן דורשים משתמש מחובר, ועובדים רק על השיחות שלו
router = APIRouter(prefix="/api/conversations", tags=["Conversations"])

HISTORY_LIMIT = 20  # כמה הודעות אחרונות נשלחות למודל


def ask_agent(history, content):
    """מריץ את הסוכן. כשל של OpenAI מחזיר 502 ולא מפיל את השרת."""
    try:
        return get_reply(history, content)
    except Exception as error:
        print("Agent error:", error)
        raise HTTPException(status_code=502, detail="The AI service is not available right now. Please try again.")


@router.get("", response_model=list[ConversationOut])
def list_conversations(user: dict = Depends(get_current_user)):
    return conversations_db.get_conversations(user["id"])


@router.post("", response_model=NewConversationResponse, status_code=201)
def create_conversation(body: MessageCreate, user: dict = Depends(get_current_user)):
    """שיחה חדשה נוצרת רק עם ההודעה הראשונה, ורק אחרי שהסוכן ענה, כדי שלא יישארו שיחות ריקות."""
    reply = ask_agent([], body.content)

    title = " ".join(body.content.split())[:50]  # ההודעה הראשונה קובעת את הכותרת
    conversation = conversations_db.create_conversation(user["id"], title)
    user_message = messages_db.add_message(conversation["id"], "user", body.content)
    assistant_message = messages_db.add_message(conversation["id"], "assistant", reply)
    return {"conversation": conversation, "user_message": user_message, "assistant_message": assistant_message}


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    conversation = conversations_db.get_conversation(conversation_id, user["id"])
    conversation["messages"] = messages_db.get_messages(conversation_id)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    conversations_db.delete_conversation(conversation_id, user["id"])


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
def send_message(conversation_id: int, body: MessageCreate, user: dict = Depends(get_current_user)):
    conversations_db.get_conversation(conversation_id, user["id"])  # 404 אם השיחה לא קיימת או לא שלו
    history = messages_db.get_last_messages(conversation_id, HISTORY_LIMIT)
    reply = ask_agent(history, body.content)

    user_message = messages_db.add_message(conversation_id, "user", body.content)
    assistant_message = messages_db.add_message(conversation_id, "assistant", reply)
    return {"user_message": user_message, "assistant_message": assistant_message}

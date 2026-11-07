from fastapi import APIRouter, HTTPException

from db import conversations_db, messages_db
from models.conversation_models import (
    MessageCreate, ConversationOut, ConversationDetail, SendMessageResponse,
)
from agent.graph import get_reply

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])

HISTORY_LIMIT = 20  # כמה הודעות אחרונות נשלחות למודל


@router.get("", response_model=list[ConversationOut])
def list_conversations():
    return conversations_db.get_conversations()


@router.post("", response_model=ConversationOut, status_code=201)
def create_conversation():
    return conversations_db.create_conversation()


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int):
    conversation = conversations_db.get_conversation(conversation_id)
    conversation["messages"] = messages_db.get_messages(conversation_id)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int):
    conversations_db.delete_conversation(conversation_id)


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
def send_message(conversation_id: int, body: MessageCreate):
    conversations_db.get_conversation(conversation_id)  # 404 אם השיחה לא קיימת
    history = messages_db.get_last_messages(conversation_id, HISTORY_LIMIT)

    try:
        reply = get_reply(history, body.content)
    except Exception as error:
        # כשל של OpenAI לא מפיל את השרת, ושום דבר לא נשמר, כך שאפשר לנסות שוב
        print("Agent error:", error)
        raise HTTPException(status_code=502, detail="The AI service is not available right now. Please try again.")

    # ההודעה הראשונה בשיחה קובעת את הכותרת
    if not history:
        title = " ".join(body.content.split())[:50]
        conversations_db.update_title(conversation_id, title)

    user_message = messages_db.add_message(conversation_id, "user", body.content)
    assistant_message = messages_db.add_message(conversation_id, "assistant", reply)
    return {"user_message": user_message, "assistant_message": assistant_message}

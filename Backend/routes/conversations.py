import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db import conversations_db, messages_db
from models.conversation_models import (
    MessageCreate, MessageOut, ConversationOut, ConversationDetail, SendMessageResponse, NewConversationResponse,
)
from agent.graph import get_reply, stream_reply
from images import delete_image, image_exists
from security import get_current_user

# כל ה-Endpoints כאן דורשים משתמש מחובר, ועובדים רק על השיחות שלו
router = APIRouter(prefix="/api/conversations", tags=["Conversations"])
logger = logging.getLogger(__name__)

HISTORY_LIMIT = 20  # כמה הודעות אחרונות נשלחות למודל
AI_ERROR = "The AI service is not available right now. Please try again."


def check_image(body):
    if body.image_path and not image_exists(body.image_path):
        raise HTTPException(status_code=400, detail="The attached image was not found. Please attach it again.")


def ask_agent(history, body):
    """מריץ את הסוכן. מחזיר (תשובה, נתיב תמונה שנוצרה או None).
    כשל של OpenAI מחזיר 502 ולא מפיל את השרת."""
    check_image(body)
    try:
        return get_reply(history, body.content, body.image_path)
    except Exception:
        logger.exception("Agent error")  # השגיאה המלאה נרשמת בלוג של השרת, והמשתמש מקבל הודעה ידידותית
        raise HTTPException(status_code=502, detail=AI_ERROR)


def make_title(body):
    """הכותרת נקבעת לפי ההודעה הראשונה (או "Image" אם נשלחה רק תמונה)."""
    return " ".join(body.content.split())[:50] or "Image"


def save_exchange(conversation_id, body, reply, generated_image):
    """שומר את ההודעה ואת התשובה. אם השמירה נכשלה, מוחקים את התמונה שהסוכן יצר,
    כדי שלא יישאר קובץ בלי הודעה."""
    try:
        return messages_db.add_exchange(conversation_id, body.content, body.image_path, reply, generated_image)
    except Exception:
        if generated_image:
            delete_image(generated_image)
        raise


def create_and_save(user_id, body, reply, generated_image):
    """שיחה חדשה עם ההודעה הראשונה והתשובה. בכשל מוחקים את התמונה שנוצרה."""
    try:
        conversation = conversations_db.create_conversation(user_id, make_title(body))
    except Exception:
        if generated_image:
            delete_image(generated_image)
        raise
    user_message, assistant_message = save_exchange(conversation["id"], body, reply, generated_image)
    return conversation, user_message, assistant_message


# ===== Streaming =====

def json_line(data):
    """אירוע אחד בשורה אחת (NDJSON): הדפדפן קורא את התשובה שורה אחר שורה."""
    return json.dumps(data, ensure_ascii=False) + "\n"


def messages_json(user_message, assistant_message):
    return {
        "user_message": MessageOut.model_validate(user_message).model_dump(mode="json"),
        "assistant_message": MessageOut.model_validate(assistant_message).model_dump(mode="json"),
    }


def stream_events(history, body, save):
    """מעביר לדפדפן את האירועים של הסוכן (tool, token). בסוף שומר ב-DB בעזרת save,
    ושולח "done" עם ההודעות השמורות. שמירה רק אחרי תשובה מלאה, כמו בלי Streaming."""
    events = stream_reply(history, body.content, body.image_path)
    try:
        for event in events:
            if event["type"] == "answer":
                yield json_line({"type": "done", **save(event["text"], event["image"])})
            else:
                yield json_line(event)
    except HTTPException as error:
        yield json_line({"type": "error", "message": error.detail})
    except Exception:
        logger.exception("Agent error (streaming)")
        yield json_line({"type": "error", "message": AI_ERROR})
    finally:
        events.close()  # אם המשתמש סגר את הדף באמצע: עוצר את הסוכן ומנקה תמונות שלא יישמרו


# ===== Endpoints =====

@router.get("", response_model=list[ConversationOut])
def list_conversations(user: dict = Depends(get_current_user)):
    return conversations_db.get_conversations(user["id"])


@router.post("", response_model=NewConversationResponse, status_code=201)
def create_conversation(body: MessageCreate, user: dict = Depends(get_current_user)):
    """שיחה חדשה נוצרת רק עם ההודעה הראשונה, ורק אחרי שהסוכן ענה, כדי שלא יישארו שיחות ריקות."""
    reply, generated_image = ask_agent([], body)
    conversation, user_message, assistant_message = create_and_save(user["id"], body, reply, generated_image)
    return {"conversation": conversation, "user_message": user_message, "assistant_message": assistant_message}


@router.post("/stream")
def create_conversation_stream(body: MessageCreate, user: dict = Depends(get_current_user)):
    """כמו POST /api/conversations, אבל התשובה מגיעה מילה אחר מילה (NDJSON)."""
    check_image(body)

    def save(reply, generated_image):
        conversation, user_message, assistant_message = create_and_save(user["id"], body, reply, generated_image)
        conversation_json = ConversationOut.model_validate(conversation).model_dump(mode="json")
        return {"conversation": conversation_json, **messages_json(user_message, assistant_message)}

    return StreamingResponse(stream_events([], body, save), media_type="application/x-ndjson")


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    conversation = conversations_db.get_conversation(conversation_id, user["id"])
    conversation["messages"] = messages_db.get_messages(conversation_id)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    conversations_db.get_conversation(conversation_id, user["id"])  # 404 אם השיחה לא קיימת או לא שלו
    image_paths = messages_db.get_image_paths(conversation_id)
    conversations_db.delete_conversation(conversation_id, user["id"])
    # ההודעות נמחקות ב-DB אוטומטית (CASCADE), ואת קבצי התמונות מוחקים כאן
    for image_path in image_paths:
        delete_image(image_path)


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
def send_message(conversation_id: int, body: MessageCreate, user: dict = Depends(get_current_user)):
    conversations_db.get_conversation(conversation_id, user["id"])  # 404 אם השיחה לא קיימת או לא שלו
    history = messages_db.get_last_messages(conversation_id, HISTORY_LIMIT)
    reply, generated_image = ask_agent(history, body)

    user_message, assistant_message = save_exchange(conversation_id, body, reply, generated_image)
    return {"user_message": user_message, "assistant_message": assistant_message}


@router.post("/{conversation_id}/messages/stream")
def send_message_stream(conversation_id: int, body: MessageCreate, user: dict = Depends(get_current_user)):
    """כמו POST /messages, אבל התשובה מגיעה מילה אחר מילה (NDJSON).
    הבדיקות (שיחה של המשתמש, תמונה קיימת) נעשות לפני שהזרם מתחיל, כדי להחזיר קוד שגיאה רגיל."""
    conversations_db.get_conversation(conversation_id, user["id"])
    check_image(body)
    history = messages_db.get_last_messages(conversation_id, HISTORY_LIMIT)

    def save(reply, generated_image):
        user_message, assistant_message = save_exchange(conversation_id, body, reply, generated_image)
        return messages_json(user_message, assistant_message)

    return StreamingResponse(stream_events(history, body, save), media_type="application/x-ndjson")

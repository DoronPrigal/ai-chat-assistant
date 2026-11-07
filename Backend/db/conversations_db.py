from fastapi import HTTPException
from db.database import get_db

# בכל הפונקציות: שיחה של משתמש אחר מחזירה 404, בדיוק כמו שיחה שלא קיימת


def create_conversation(user_id, title):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("INSERT INTO conversations (user_id, title) VALUES (%s, %s)", (user_id, title))
    conn.commit()
    cursor.execute("SELECT * FROM conversations WHERE id = %s", (cursor.lastrowid,))
    conversation = cursor.fetchone()
    cursor.close()
    conn.close()
    return conversation


def get_conversations(user_id):
    """השיחות של המשתמש, מהאחרונה שעודכנה לישנה ביותר."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM conversations WHERE user_id = %s ORDER BY updated_at DESC, id DESC",
        (user_id,),
    )
    conversations = cursor.fetchall()
    cursor.close()
    conn.close()
    return conversations


def get_conversation(conversation_id, user_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM conversations WHERE id = %s AND user_id = %s",
        (conversation_id, user_id),
    )
    conversation = cursor.fetchone()
    cursor.close()
    conn.close()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def delete_conversation(conversation_id, user_id):
    """מוחק שיחה. ההודעות שלה נמחקות אוטומטית (ON DELETE CASCADE)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM conversations WHERE id = %s AND user_id = %s",
        (conversation_id, user_id),
    )
    conn.commit()
    deleted = cursor.rowcount
    cursor.close()
    conn.close()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

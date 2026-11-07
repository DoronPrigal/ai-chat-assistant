from fastapi import HTTPException
from db.database import get_db


def create_conversation():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("INSERT INTO conversations (title) VALUES (%s)", ("New chat",))
    conn.commit()
    cursor.execute("SELECT * FROM conversations WHERE id = %s", (cursor.lastrowid,))
    conversation = cursor.fetchone()
    cursor.close()
    conn.close()
    return conversation


def get_conversations():
    """כל השיחות, מהאחרונה שעודכנה לישנה ביותר."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM conversations ORDER BY updated_at DESC, id DESC")
    conversations = cursor.fetchall()
    cursor.close()
    conn.close()
    return conversations


def get_conversation(conversation_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
    conversation = cursor.fetchone()
    cursor.close()
    conn.close()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def update_title(conversation_id, title):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET title = %s WHERE id = %s", (title, conversation_id))
    conn.commit()
    cursor.close()
    conn.close()


def delete_conversation(conversation_id):
    """מוחק שיחה. ההודעות שלה נמחקות אוטומטית (ON DELETE CASCADE)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conversations WHERE id = %s", (conversation_id,))
    conn.commit()
    deleted = cursor.rowcount
    cursor.close()
    conn.close()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

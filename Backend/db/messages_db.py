from db.database import get_db

# שימו לב: הפונקציות כאן לא בודקות למי השיחה שייכת.
# כל נתיב חייב לבדוק קודם עם conversations_db.get_conversation(conversation_id, user_id).


def get_messages(conversation_id):
    """כל ההודעות של שיחה, לפי סדר הכתיבה."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM messages WHERE conversation_id = %s ORDER BY id", (conversation_id,))
    messages = cursor.fetchall()
    cursor.close()
    conn.close()
    return messages


def get_last_messages(conversation_id, limit):
    """N ההודעות האחרונות, כדי לא לשלוח למודל את כל השיחה (חוסך עלות)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM messages WHERE conversation_id = %s ORDER BY id DESC LIMIT %s",
        (conversation_id, limit),
    )
    messages = cursor.fetchall()
    cursor.close()
    conn.close()
    messages.reverse()  # חזרה לסדר כרונולוגי
    return messages


def add_message(conversation_id, role, content, image_path=None):
    """שומר הודעה ומעדכן את זמן העדכון של השיחה (למיון רשימת השיחות)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "INSERT INTO messages (conversation_id, role, content, image_path) VALUES (%s, %s, %s, %s)",
        (conversation_id, role, content, image_path),
    )
    message_id = cursor.lastrowid
    cursor.execute("UPDATE conversations SET updated_at = NOW() WHERE id = %s", (conversation_id,))
    conn.commit()
    cursor.execute("SELECT * FROM messages WHERE id = %s", (message_id,))
    message = cursor.fetchone()
    cursor.close()
    conn.close()
    return message

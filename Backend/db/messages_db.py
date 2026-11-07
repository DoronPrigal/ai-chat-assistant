import mysql.connector
from fastapi import HTTPException

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


def get_image_paths(conversation_id):
    """נתיבי כל התמונות בשיחה (כדי למחוק את הקבצים כשמוחקים את השיחה)."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT image_path FROM messages WHERE conversation_id = %s AND image_path IS NOT NULL",
        (conversation_id,),
    )
    paths = [row["image_path"] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return paths


def add_exchange(conversation_id, user_content, user_image, reply, reply_image):
    """שומר את הודעת המשתמש ואת תשובת הסוכן יחד, בטרנזקציה אחת: או ששתיהן נשמרות, או אף אחת.
    בנוסף מעדכן את זמן העדכון של השיחה (למיון רשימת השיחות)."""
    sql = "INSERT INTO messages (conversation_id, role, content, image_path) VALUES (%s, %s, %s, %s)"
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, (conversation_id, "user", user_content, user_image))
        user_message_id = cursor.lastrowid
        cursor.execute(sql, (conversation_id, "assistant", reply, reply_image))
        reply_id = cursor.lastrowid
        cursor.execute("UPDATE conversations SET updated_at = NOW() WHERE id = %s", (conversation_id,))
        conn.commit()
    except mysql.connector.IntegrityError:
        # השיחה נמחקה בזמן שהסוכן ענה (המפתח הזר כבר לא קיים)
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    cursor.execute("SELECT * FROM messages WHERE id IN (%s, %s) ORDER BY id", (user_message_id, reply_id))
    user_message, reply_message = cursor.fetchall()
    cursor.close()
    conn.close()
    return user_message, reply_message

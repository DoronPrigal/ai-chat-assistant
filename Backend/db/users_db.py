import mysql.connector
from fastapi import HTTPException
from db.database import get_db


def create_user(username, password_hash):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, password_hash))
        conn.commit()
    except mysql.connector.IntegrityError:
        # username מוגדר UNIQUE, אז MySQL עצמו מונע כפילות
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="This username is already taken")
    cursor.execute("SELECT id, username, created_at FROM users WHERE id = %s", (cursor.lastrowid,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user


def get_user_by_username(username):
    """כולל password_hash, לבדיקת הסיסמה בהתחברות."""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user


def get_user_by_id(user_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user

import mysql.connector
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME


def get_db():
    """פותח חיבור חדש ל-MySQL."""
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
    )


def create_tables():
    """יוצר את הטבלאות בהרצה הראשונה (אם הן עוד לא קיימות)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) DEFAULT CHARSET=utf8mb4
    """)

    # כל שיחה שייכת למשתמש. מחיקת משתמש מוחקת גם את השיחות שלו.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(100) NOT NULL DEFAULT 'New chat',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) DEFAULT CHARSET=utf8mb4
    """)

    # role מראה מי אמר את ההודעה, ו-conversation_id לאיזו שיחה היא שייכת
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            role ENUM('user', 'assistant') NOT NULL,
            content MEDIUMTEXT NOT NULL,
            image_path VARCHAR(255) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        ) DEFAULT CHARSET=utf8mb4
    """)

    conn.commit()
    cursor.close()
    conn.close()

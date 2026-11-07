"""מוחק את משתמשי הבדיקה ואת קבצי התמונות שנשארו בלי הודעה.
משתמשים אמיתיים (בלי קידומת של בדיקה, למשל doron ו-admin) לא נמחקים.
הרצה: ..\\Backend\\env\\Scripts\\python.exe cleanup.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from config import UPLOADS_DIR  # noqa: E402
from db.database import get_db  # noqa: E402

# הקידומות של משתמשי הבדיקה בסקריפטים
TEST_PREFIXES = ["test_", "e2e_", "ui_", "img_", "polish_", "axe_", "bonus_", "stream_", "sbad_", "scroll_",
                 "resp_", "flash_", "wx_", "fix_", "rev_"]

conn = get_db()
cursor = conn.cursor()
where = " OR ".join(["username LIKE %s"] * len(TEST_PREFIXES))
patterns = [prefix.replace("_", r"\_") + "%" for prefix in TEST_PREFIXES]
cursor.execute(f"DELETE FROM users WHERE {where}", patterns)  # השיחות וההודעות נמחקות ב-CASCADE
print("test users deleted:", cursor.rowcount)
conn.commit()

# קבצים ב-uploads ששום הודעה לא מפנה אליהם
cursor.execute("SELECT image_path FROM messages WHERE image_path IS NOT NULL")
referenced = {row[0].removeprefix("/uploads/") for row in cursor.fetchall()}
cursor.execute("SELECT username FROM users ORDER BY id")
print("users left:", [row[0] for row in cursor.fetchall()])
cursor.close()
conn.close()

for file in UPLOADS_DIR.iterdir():
    if file.is_file() and file.name not in referenced:
        file.unlink()
        print("orphan image deleted:", file.name)

import json
import sys
from pathlib import Path
import time
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from db.database import get_db  # noqa: E402

# משתמש בדיקה דרך ה-API, ושיחה ארוכה ישירות ב-DB (בלי קריאות ל-OpenAI)
req = urllib.request.Request("http://127.0.0.1:8000/api/auth/register", method="POST",
                             headers={"Content-Type": "application/json"},
                             data=json.dumps({"username": f"scroll_{int(time.time())}", "password": "scroll-pass-1"}).encode())
auth = json.load(urllib.request.urlopen(req))

LAST = """הנה פונקציה שהופכת מחרוזת: `return text[::-1]` היא השורה החשובה.

```python
def reverse_text(text):
    # הופך את סדר התווים
    return text[::-1]
```

בהצלחה!"""

conn = get_db()
cur = conn.cursor()
cur.execute("INSERT INTO conversations (user_id, title) VALUES (%s, %s)", (auth["user"]["id"], "Long scroll test"))
cid = cur.lastrowid
for i in range(1, 15):
    cur.execute("INSERT INTO messages (conversation_id, role, content) VALUES (%s, 'user', %s)", (cid, f"Question number {i}: tell me something interesting."))
    cur.execute("INSERT INTO messages (conversation_id, role, content) VALUES (%s, 'assistant', %s)",
                (cid, f"Answer number {i}. " + "This is a longer answer that takes a few lines on the screen. " * 3))
cur.execute("INSERT INTO messages (conversation_id, role, content) VALUES (%s, 'user', %s)", (cid, "איך הופכים מחרוזת בפייתון?"))
cur.execute("INSERT INTO messages (conversation_id, role, content) VALUES (%s, 'assistant', %s)", (cid, LAST))
conn.commit()
cur.close()
conn.close()
print(json.dumps({"token": auth["access_token"], "cid": cid}))

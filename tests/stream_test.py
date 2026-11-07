import http.client
import json
import sys
from pathlib import Path
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from db.database import get_db  # noqa: E402

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
failures = 0


def check(name, ok, extra=""):
    global failures
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {extra}" if extra else ""))
    failures += 0 if ok else 1


def post(path, body, token=None, stream=False):
    conn = http.client.HTTPConnection("127.0.0.1", PORT, timeout=90)
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})}
    conn.request("POST", "/api" + path, body=json.dumps(body), headers=headers)
    response = conn.getresponse()
    if stream:
        return conn, response
    data = response.read()
    conn.close()
    return response.status, json.loads(data or b"null")


def read_events(response, stop_after_tokens=None):
    """קורא אירועים שורה אחר שורה, עם הזמן (בשניות) שבו כל אחד הגיע."""
    start = time.time()
    events = []
    while True:
        line = response.readline()
        if not line:
            break
        event = json.loads(line)
        events.append((round(time.time() - start, 2), event))
        if stop_after_tokens and sum(e["type"] == "token" for _, e in events) >= stop_after_tokens:
            break
    return events


def count_conversations(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM conversations WHERE user_id = %s", (user_id,))
    n = cur.fetchone()[0]
    cur.close()
    conn.close()
    return n


s, a = post("/auth/register", {"username": f"stream_{int(time.time())}", "password": "stream-pass-1"})
token, uid = a["access_token"], a["user"]["id"]
s, b = post("/auth/register", {"username": f"stream_b_{int(time.time())}", "password": "stream-pass-1"})
other = b["access_token"]

# 1. שיחה חדשה עם כלי (מזג אוויר): חיווי כלי, מילים בהדרגה, ו-done עם ההודעות השמורות
conn, r = post("/conversations/stream", {"content": "What's the weather in Haifa right now? Two sentences."}, token, stream=True)
check("stream starts with 200 and NDJSON", r.status == 200 and r.getheader("content-type").startswith("application/x-ndjson"))
events = read_events(r)
conn.close()
types = [e["type"] for _, e in events]
tokens = [(t, e) for t, e in events if e["type"] == "token"]
tool_events = [e["name"] for _, e in events if e["type"] == "tool"]
done = events[-1][1]
check("tool event before the answer", tool_events == ["get_weather"] and types.index("tool") < types.index("token"), tool_events)
check(f"answer arrives in many pieces ({len(tokens)} tokens)", len(tokens) > 5)
spread = tokens[-1][0] - tokens[0][0]
check(f"pieces arrive over time, not all at once (first {tokens[0][0]}s, last {tokens[-1][0]}s)", spread > 0.2)
streamed_text = "".join(e["text"] for _, e in tokens)
check("done event has conversation + saved messages", done["type"] == "done" and done["conversation"]["id"] and
      done["assistant_message"]["role"] == "assistant")
check("saved answer == streamed text", done["assistant_message"]["content"] == streamed_text)
cid = done["conversation"]["id"]
print("      answer:", streamed_text)

# 2. המשך באותו הקשר
conn, r = post(f"/conversations/{cid}/messages/stream", {"content": "Which city did I ask about? One word."}, token, stream=True)
events = read_events(r)
conn.close()
check("continue with context (streaming)", events[-1][1]["type"] == "done" and "haifa" in events[-1][1]["assistant_message"]["content"].lower(),
      events[-1][1].get("assistant_message", {}).get("content"))

# 3. שגיאות לפני שהזרם מתחיל: קוד HTTP רגיל
check("other user's conversation -> 404 (before streaming)", post(f"/conversations/{cid}/messages/stream", {"content": "hi"}, other)[0] == 404)
check("no token -> 401", post("/conversations/stream", {"content": "hi"})[0] == 401)
check("empty message -> 422", post("/conversations/stream", {"content": " "}, token)[0] == 422)
check("missing image -> 400", post("/conversations/stream", {"image_path": "/uploads/" + "a" * 32 + ".png"}, token)[0] == 400)

# 4. המשתמש סוגר את החיבור באמצע התשובה: שום דבר לא נשמר
before = count_conversations(uid)
conn, r = post("/conversations/stream", {"content": "Write 5 sentences about the sea."}, token, stream=True)
read_events(r, stop_after_tokens=3)
conn.close()
time.sleep(6)
check("disconnect mid-answer -> nothing saved", count_conversations(uid) == before)

print("\nALL PASSED" if failures == 0 else f"\n{failures} FAILED")
print("TOKEN", token)

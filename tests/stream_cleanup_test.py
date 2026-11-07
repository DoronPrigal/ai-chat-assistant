import base64
import http.client
import json
import sys
from pathlib import Path
import time
from types import SimpleNamespace

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from langchain_core.messages import AIMessage, AIMessageChunk  # noqa: E402
import agent.graph as graph  # noqa: E402
import agent.tools as tools  # noqa: E402
from config import UPLOADS_DIR  # noqa: E402

files_before = set(p.name for p in UPLOADS_DIR.iterdir())
new_files = lambda: set(p.name for p in UPLOADS_DIR.iterdir()) - files_before  # noqa: E731

# 1. שרת עם מפתח לא תקין: הזרם נפתח ושולח אירוע error ידידותי
time.sleep(1)
conn = http.client.HTTPConnection("127.0.0.1", 8002, timeout=60)
conn.request("POST", "/api/auth/register", body=json.dumps({"username": f"sbad_{int(time.time())}", "password": "x-pass-123"}),
             headers={"Content-Type": "application/json"})
token = json.loads(conn.getresponse().read())["access_token"]
conn.request("POST", "/api/conversations/stream", body=json.dumps({"content": "hello"}),
             headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
lines = [json.loads(line) for line in conn.getresponse().read().decode().splitlines() if line]
conn.close()
print(("PASS" if lines and lines[-1] == {"type": "error", "message": "The AI service is not available right now. Please try again."}
       else "FAIL") + "  OpenAI failure -> friendly error event", lines)

# 2-3. סימולציה (בלי עלות): מודל מזויף שמבקש תמונה, ושירות תמונות מזויף
tools.image_client.images.generate = lambda **kw: SimpleNamespace(
    data=[SimpleNamespace(b64_json=base64.b64encode(b"RIFF0000WEBPfake").decode())])


class FakeModel:
    def __init__(self, second):
        self.calls, self.second = 0, second

    def invoke(self, messages):
        self.calls += 1
        if self.calls == 1:
            return AIMessage(content="", tool_calls=[{"name": "generate_image", "args": {"prompt": "a cat"}, "id": "c1"}])
        if self.second == "fail":
            raise RuntimeError("OpenAI failed after the image was created")
        return AIMessageChunk(content="Here is your cat.")  # כמו מודל אמיתי ב-Streaming


graph.llm_with_tools = FakeModel("fail")
events = []
try:
    for event in graph.stream_reply([], "draw a cat"):
        events.append(event["type"])
except RuntimeError:
    pass
print(("PASS" if not new_files() else "FAIL") + f"  streaming fails after image -> file deleted (events: {events})")

graph.llm_with_tools = FakeModel("ok")
stream = graph.stream_reply([], "draw a cat")
for event in stream:  # התמונה כבר נוצרה; ב-token הראשון "המשתמש" סוגר את הדף
    if event["type"] == "token":
        break
stream.close()
print(("PASS" if not new_files() else "FAIL") + "  user disconnects before the answer ends -> file deleted")

graph.llm_with_tools = FakeModel("ok")
answer = [e for e in graph.stream_reply([], "draw a cat") if e["type"] == "answer"][0]
print(("PASS" if answer["image"] and (UPLOADS_DIR / answer["image"].removeprefix("/uploads/")).exists() else "FAIL")
      + f"  streaming success -> image kept ({answer['image']})")
(UPLOADS_DIR / answer["image"].removeprefix("/uploads/")).unlink()
print("leftover files:", new_files() or "none")
